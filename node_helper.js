/*
 * MMM-StylishCalendar
 * MIT license
 */

"use strict";

const NodeHelper = require("node_helper");
const ical = require("node-ical");
const moment = require("moment");
const fetch = require("node-fetch");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

module.exports = NodeHelper.create({
  start: function() {
    console.log(`[MMM-StylishCalendar] Node helper started`);
    
    this.calendars = {};
    this.calendarInstances = {};
    this.authServers = {};
    
    // Initialize express app for the setup UI
    this.expressApp = express();
    this.expressApp.use(bodyParser.json());
    this.expressApp.use(bodyParser.urlencoded({ extended: true }));
    this.expressApp.use("/MMM-StylishCalendar", express.static(path.resolve(module.exports.path + "/public")));
  },
  
  socketNotificationReceived: function(notification, payload) {
    switch (notification) {
      case "INIT_CALENDAR":
        this.initCalendar(payload.instanceId, payload.config);
        // Start auth server if apple calendar is enabled
        if (payload.config.appleCalendarIntegration && !this.authServers[payload.instanceId]) {
          this.startAuthServer(payload.instanceId, payload.config);
        }
        break;
        
      case "GET_CALENDAR_EVENTS":
        this.getCalendarEvents(payload.instanceId, payload.config);
        break;
    }
  },
  
  initCalendar: function(instanceId, config) {
    this.calendarInstances[instanceId] = {
      config: config,
      calendars: []
    };
    
    if (config.calendars.length > 0) {
      this.loadCalendars(instanceId);
    }
  },
  
  loadCalendars: function(instanceId) {
    const instance = this.calendarInstances[instanceId];
    if (!instance) return;
    
    instance.config.calendars.forEach(calendar => {
      if (!this.calendars[calendar.url]) {
        this.calendars[calendar.url] = {
          url: calendar.url,
          type: calendar.type || "web",
          name: calendar.name || "Calendar",
          symbol: calendar.symbol || instance.config.defaultSymbol,
          category: calendar.category || "default",
          color: calendar.color || "#ca5010",
          auth: calendar.auth || null,
          events: [],
          lastFetched: null
        };
      }
    });
  },
  
  getCalendarEvents: function(instanceId, config) {
    const instance = this.calendarInstances[instanceId];
    if (!instance) return;
    
    // Reload calendars in case they changed
    this.loadCalendars(instanceId);
    
    const promises = [];
    const now = moment();
    
    // Check each calendar if it needs an update
    instance.config.calendars.forEach(calendarConfig => {
      const calendar = this.calendars[calendarConfig.url];
      
      if (!calendar) return;
      
      // If last fetch was more than 15 minutes ago or never fetched
      if (!calendar.lastFetched || moment().diff(calendar.lastFetched, 'minutes') > 15) {
        const promise = this.fetchCalendar(instanceId, calendar)
          .then(events => {
            calendar.events = events;
            calendar.lastFetched = moment();
            return events;
          })
          .catch(error => {
            console.error(`[MMM-StylishCalendar] Error fetching calendar ${calendar.name}:`, error);
            return [];
          });
        
        promises.push(promise);
      } else {
        promises.push(Promise.resolve(calendar.events));
      }
    });
    
    // When all calendars are fetched, send events back
    Promise.all(promises)
      .then(results => {
        // Flatten events from all calendars
        let allEvents = [].concat(...results);
        
        // Sort events by start date
        allEvents.sort((a, b) => moment(a.startDate).valueOf() - moment(b.startDate).valueOf());
        
        // Filter events based on config
        allEvents = this.filterEvents(allEvents, config);
        
        this.sendSocketNotification("CALENDAR_EVENTS", {
          instanceId: instanceId,
          events: allEvents
        });
      })
      .catch(error => {
        console.error("[MMM-StylishCalendar] Error getting events:", error);
      });
  },
  
  fetchCalendar: function(instanceId, calendar) {
    const fetchOptions = {};
    
    // Add authentication if provided
    if (calendar.auth) {
      if (calendar.auth.method === "basic") {
        const base64Auth = Buffer.from(`${calendar.auth.user}:${calendar.auth.pass}`).toString("base64");
        fetchOptions.headers = {
          "Authorization": `Basic ${base64Auth}`
        };
      } else if (calendar.auth.method === "bearer") {
        fetchOptions.headers = {
          "Authorization": `Bearer ${calendar.auth.token}`
        };
      }
    }
    
    return fetch(calendar.url, fetchOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        const data = ical.parseICS(text);
        return this.processICalData(data, calendar);
      });
  },
  
  processICalData: function(data, calendar) {
    const events = [];
    
    for (const k in data) {
      if (data.hasOwnProperty(k)) {
        const event = data[k];
        
        if (event.type !== "VEVENT") {
          continue;
        }
        
        // Skip events without start date
        if (!event.start) {
          continue;
        }
        
        // Process recurring events
        if (event.rrule) {
          const now = moment();
          const until = moment().add(90, "days"); // Look ahead 90 days max
          
          event.rrule.options.dtstart = event.start;
          const dates = event.rrule.between(now.toDate(), until.toDate(), true);
          
          // Add each recurring instance
          for (const date of dates) {
            const startDate = moment(date);
            let endDate;
            
            if (event.end) {
              // Calculate duration and apply to each instance
              const duration = moment(event.end).diff(moment(event.start));
              endDate = moment(startDate).add(duration, "milliseconds");
            } else {
              endDate = moment(startDate).add(1, "hours");
            }
            
            events.push({
              title: event.summary || "Untitled Event",
              startDate: startDate.toDate(),
              endDate: endDate.toDate(),
              fullDayEvent: !event.end || event.start.dateOnly,
              description: event.description || "",
              location: event.location || "",
              calendarName: calendar.name,
              calendarSymbol: calendar.symbol,
              calendarCategory: calendar.category,
              calendarColor: calendar.color
            });
          }
        } else {
          // Single event
          events.push({
            title: event.summary || "Untitled Event",
            startDate: event.start,
            endDate: event.end || moment(event.start).add(1, "hours").toDate(),
            fullDayEvent: !event.end || event.start.dateOnly,
            description: event.description || "",
            location: event.location || "",
            calendarName: calendar.name,
            calendarSymbol: calendar.symbol,
            calendarCategory: calendar.category,
            calendarColor: calendar.color
          });
        }
      }
    }
    
    return events;
  },
  
  filterEvents: function(events, config) {
    const now = moment();
    const future = moment().add(config.maximumDaysInFuture, "days");
    
    // Filter events based on date range and max entries
    return events
      .filter(event => {
        const eventStart = moment(event.startDate);
        return eventStart.isBetween(now, future, null, "[]");
      })
      .slice(0, config.maximumEntries);
  },
  
  startAuthServer: function(instanceId, config) {
    const port = config.calendarServerPort;
    
    // Check if the port is already in use
    if (this.authServers[instanceId]) {
      console.log(`[MMM-StylishCalendar] Auth server already running for instance ${instanceId}`);
      return;
    }
    
    // Create the storage directory if it doesn't exist
    const storagePath = path.join(this.path, "calendars");
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    
    // Setup routes for authentication
    this.expressApp.get("/auth/apple-calendar", (req, res) => {
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });
    
    this.expressApp.post("/api/apple-calendar", (req, res) => {
      const { name, url, username, password } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      
      const calendarConfig = {
        name: name,
        url: url,
        symbol: req.body.symbol || "calendar",
        color: req.body.color || "#ca5010",
        category: req.body.category || "default",
        type: "apple",
        auth: null
      };
      
      // Add authentication if provided
      if (username && password) {
        calendarConfig.auth = {
          method: "basic",
          user: username,
          pass: password
        };
      }
      
      // Store the calendar configuration
      const calendarConfigPath = path.join(storagePath, `${instanceId}-calendars.json`);
      try {
        let calendars = [];
        if (fs.existsSync(calendarConfigPath)) {
          calendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
        }
        
        // Check if calendar already exists
        const exists = calendars.some(cal => cal.url === url);
        if (!exists) {
          calendars.push(calendarConfig);
          fs.writeFileSync(calendarConfigPath, JSON.stringify(calendars, null, 2));
        }
        
        // Send notification about new calendar
        this.sendSocketNotification("APPLE_CALENDAR_AUTH_SUCCESS", {
          instanceId: instanceId,
          calendars: [calendarConfig]
        });
        
        return res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error saving calendar config:`, error);
        return res.status(500).json({ success: false, error: "Failed to save calendar" });
      }
    });
    
    // Start the server if not already running
    if (!this.expressAppStarted) {
      this.expressApp.listen(port, () => {
        console.log(`[MMM-StylishCalendar] Calendar setup server running at http://localhost:${port}/auth/apple-calendar`);
        this.expressAppStarted = true;
        
        this.sendSocketNotification("APPLE_CALENDAR_AUTH_RUNNING", {
          instanceId: instanceId,
          port: port
        });
      });
    } else {
      // Just notify that the auth server is available
      this.sendSocketNotification("APPLE_CALENDAR_AUTH_RUNNING", {
        instanceId: instanceId,
        port: port
      });
    }
    
    // Store server reference
    this.authServers[instanceId] = true;
  }
});