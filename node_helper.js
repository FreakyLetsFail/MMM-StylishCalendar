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
    this.settings = {};
    
    // Create storage path
    this.storagePath = path.join(this.path, "calendars");
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    
    // Initialize express app for the setup UI
    this.expressApp = express();
    this.expressApp.use(bodyParser.json());
    this.expressApp.use(bodyParser.urlencoded({ extended: true }));
    this.expressApp.use("/MMM-StylishCalendar", express.static(path.resolve(module.exports.path + "/public")));
    
    // Setup API endpoints
    this.setupAPIRoutes();
    
    // Check existing calendar files
    try {
      if (fs.existsSync(this.storagePath)) {
        const files = fs.readdirSync(this.storagePath);
        const calendarFiles = files.filter(file => file.endsWith('-calendars.json'));
        console.log(`[MMM-StylishCalendar] Found ${calendarFiles.length} calendar files in storage`);
        
        if (calendarFiles.length > 0) {
          calendarFiles.forEach(file => {
            try {
              const fullPath = path.join(this.storagePath, file);
              const fileStats = fs.statSync(fullPath);
              const fileSizeMB = fileStats.size / (1024 * 1024);
              const lastModified = new Date(fileStats.mtime).toLocaleString();
              
              console.log(`[MMM-StylishCalendar] - ${file}: ${fileSizeMB.toFixed(2)} MB, modified: ${lastModified}`);
              
              // Check file content
              const calData = JSON.parse(fs.readFileSync(fullPath, "utf8"));
              if (calData && Array.isArray(calData)) {
                console.log(`[MMM-StylishCalendar]   - Contains ${calData.length} calendars`);
              }
            } catch (err) {
              console.error(`[MMM-StylishCalendar] Error reading file ${file}:`, err);
            }
          });
        }
      }
    } catch (e) {
      console.error(`[MMM-StylishCalendar] Error scanning calendar directory:`, e);
    }
    
    // Log setup information
    console.log(`[MMM-StylishCalendar] Storage path: ${this.storagePath}`);
    console.log(`[MMM-StylishCalendar] Setup UI available at: /MMM-StylishCalendar/setup.html`);
  },
  
  setupAPIRoutes: function() {
    // Setup route for the setup UI
    this.expressApp.get("/MMM-StylishCalendar/setup", (req, res) => {
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });
    
    // ==== Calendar API endpoints ====
    // Get all calendars for an instance
    this.expressApp.get("/MMM-StylishCalendar/api/calendars/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const calendarConfigPath = path.join(this.storagePath, `${instanceId}-calendars.json`);
      
      try {
        if (fs.existsSync(calendarConfigPath)) {
          const calendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
          console.log(`[MMM-StylishCalendar] API: Returning ${calendars.length} calendars for ${instanceId}`);
          res.json({ success: true, calendars: calendars });
        } else {
          console.log(`[MMM-StylishCalendar] API: No calendar file found for ${instanceId}, returning empty array`);
          
          // Check for any calendar file and use it
          const files = fs.readdirSync(this.storagePath);
          const calendarFiles = files.filter(file => file.endsWith('-calendars.json'));
          
          if (calendarFiles.length > 0) {
            console.log(`[MMM-StylishCalendar] API: Found other calendar files: ${calendarFiles.join(', ')}`);
            // Use the first file found
            const firstFilePath = path.join(this.storagePath, calendarFiles[0]);
            const otherCalendars = JSON.parse(fs.readFileSync(firstFilePath, "utf8"));
            
            // Copy this file to the requested instance ID
            fs.writeFileSync(calendarConfigPath, JSON.stringify(otherCalendars, null, 2));
            console.log(`[MMM-StylishCalendar] API: Copied ${otherCalendars.length} calendars to ${calendarConfigPath}`);
            
            return res.json({ success: true, calendars: otherCalendars });
          }
          
          res.json({ success: true, calendars: [] });
        }
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error loading calendars:`, error);
        res.status(500).json({ success: false, error: "Failed to load calendars" });
      }
    });
    
    // Add a new calendar
    this.expressApp.post("/MMM-StylishCalendar/api/calendars/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const calendarConfig = req.body;
      
      if (!calendarConfig.name || !calendarConfig.url) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      
      const calendarConfigPath = path.join(this.storagePath, `${instanceId}-calendars.json`);
      
      try {
        let calendars = [];
        if (fs.existsSync(calendarConfigPath)) {
          calendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
        }
        
        // Check if calendar already exists
        const exists = calendars.some(cal => cal.url === calendarConfig.url);
        if (exists) {
          return res.status(409).json({ success: false, error: "Calendar with this URL already exists" });
        }
        
        calendars.push(calendarConfig);
        fs.writeFileSync(calendarConfigPath, JSON.stringify(calendars, null, 2));
        
        // Update all instances with this calendar
        Object.keys(this.calendarInstances).forEach(id => {
          // Add to all instances that match the current ID pattern
          if (id === instanceId || id.includes('calendar')) {
            console.log(`[MMM-StylishCalendar] Adding calendar to instance: ${id}`);
            if (!this.calendarInstances[id].config.calendars) {
              this.calendarInstances[id].config.calendars = [];
            }
            this.calendarInstances[id].config.calendars.push(calendarConfig);
          }
        });
        
        // Notify the module about the new calendar
        this.sendSocketNotification("CALENDAR_UPDATED", {
          instanceId: instanceId,
          calendars: calendars
        });
        
        console.log(`[MMM-StylishCalendar] Calendar added: ${calendarConfig.name} (${calendarConfig.url})`);
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error saving calendar:`, error);
        res.status(500).json({ success: false, error: "Failed to save calendar" });
      }
    });
    
    // Update an existing calendar
    this.expressApp.put("/MMM-StylishCalendar/api/calendars/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const updatedCalendar = req.body;
      
      if (!updatedCalendar.name || !updatedCalendar.url) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      
      const calendarConfigPath = path.join(this.storagePath, `${instanceId}-calendars.json`);
      
      try {
        if (!fs.existsSync(calendarConfigPath)) {
          return res.status(404).json({ success: false, error: "No calendars found" });
        }
        
        let calendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
        
        // Find the calendar to update
        const index = calendars.findIndex(cal => cal.url === updatedCalendar.url);
        if (index === -1) {
          return res.status(404).json({ success: false, error: "Calendar not found" });
        }
        
        // Update the calendar
        calendars[index] = updatedCalendar;
        fs.writeFileSync(calendarConfigPath, JSON.stringify(calendars, null, 2));
        
        // Notify the module about the updated calendar
        this.sendSocketNotification("CALENDAR_UPDATED", {
          instanceId: instanceId,
          calendars: calendars
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error updating calendar:`, error);
        res.status(500).json({ success: false, error: "Failed to update calendar" });
      }
    });
    
    // Delete a calendar
    this.expressApp.delete("/MMM-StylishCalendar/api/calendars/:instanceId/:url", (req, res) => {
      const instanceId = req.params.instanceId;
      const url = decodeURIComponent(req.params.url);
      
      const calendarConfigPath = path.join(this.storagePath, `${instanceId}-calendars.json`);
      
      try {
        if (!fs.existsSync(calendarConfigPath)) {
          return res.status(404).json({ success: false, error: "No calendars found" });
        }
        
        let calendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
        
        // Filter out the calendar to delete
        const newCalendars = calendars.filter(cal => cal.url !== url);
        
        // If nothing was removed, the calendar wasn't found
        if (newCalendars.length === calendars.length) {
          return res.status(404).json({ success: false, error: "Calendar not found" });
        }
        
        fs.writeFileSync(calendarConfigPath, JSON.stringify(newCalendars, null, 2));
        
        // Notify the module about the deleted calendar
        this.sendSocketNotification("CALENDAR_UPDATED", {
          instanceId: instanceId,
          calendars: newCalendars
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error deleting calendar:`, error);
        res.status(500).json({ success: false, error: "Failed to delete calendar" });
      }
    });
    
    // Get settings
    this.expressApp.get("/MMM-StylishCalendar/api/settings/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      
      try {
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          console.log(`[MMM-StylishCalendar] API: Loaded settings for ${instanceId}:`, settings);
          res.json({ success: true, settings: settings });
        } else {
          // Create default settings file if it doesn't exist
          const defaultSettings = { maximumEntries: 10 };
          fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
          console.log(`[MMM-StylishCalendar] API: Created default settings for ${instanceId}`);
          res.json({ success: true, settings: defaultSettings });
        }
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error loading settings:`, error);
        res.status(500).json({ success: false, error: "Failed to load settings" });
      }
    });
    
    // Save settings
    this.expressApp.post("/MMM-StylishCalendar/api/settings/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const settings = req.body;
      
      if (settings.maximumEntries === undefined) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        
        // Notify the module about the updated settings
        this.sendSocketNotification("SETTINGS_UPDATED", {
          instanceId: instanceId,
          settings: settings
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error saving settings:`, error);
        res.status(500).json({ success: false, error: "Failed to save settings" });
      }
    });
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
    console.log(`[MMM-StylishCalendar] Initializing calendar for instance ${instanceId}`);
    
    this.calendarInstances[instanceId] = {
      config: config,
      calendars: []
    };
    
    // Try to load calendars from storage first - two-step approach
    // 1. Direct match with instanceId
    const calendarConfigPath = path.join(this.storagePath, `${instanceId}-calendars.json`);
    let calendarLoaded = false;
    
    if (fs.existsSync(calendarConfigPath)) {
      try {
        const savedCalendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
        if (savedCalendars && savedCalendars.length > 0) {
          // Use saved calendars instead of config calendars
          config.calendars = savedCalendars;
          console.log(`[MMM-StylishCalendar] Loaded ${savedCalendars.length} calendars directly from ${calendarConfigPath}`);
          calendarLoaded = true;
        }
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error loading calendars from storage:`, error);
      }
    } else {
      // Create empty file if it doesn't exist
      try {
        fs.writeFileSync(calendarConfigPath, JSON.stringify([], null, 2));
        console.log(`[MMM-StylishCalendar] Created empty calendar config file at ${calendarConfigPath}`);
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error creating calendar config file:`, error);
      }
    }
    
    // 2. If not found directly, look for any calendar file and use the first one
    if (!calendarLoaded) {
      try {
        console.log(`[MMM-StylishCalendar] No direct calendar match, searching all calendars...`);
        const files = fs.readdirSync(this.storagePath);
        const calendarFiles = files.filter(file => file.endsWith('-calendars.json'));
        
        if (calendarFiles.length > 0) {
          const firstCalendarFile = calendarFiles[0];
          const fullPath = path.join(this.storagePath, firstCalendarFile);
          const savedCalendars = JSON.parse(fs.readFileSync(fullPath, "utf8"));
          
          if (savedCalendars && savedCalendars.length > 0) {
            config.calendars = savedCalendars;
            console.log(`[MMM-StylishCalendar] Loaded ${savedCalendars.length} calendars from found file: ${fullPath}`);
            
            // Also save with the new instance ID for future use
            fs.writeFileSync(calendarConfigPath, JSON.stringify(savedCalendars, null, 2));
            console.log(`[MMM-StylishCalendar] Saved calendars to new instance location: ${calendarConfigPath}`);
            calendarLoaded = true;
          }
        } else {
          console.log(`[MMM-StylishCalendar] No calendar files found in ${this.storagePath}`);
        }
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error searching for calendar files:`, error);
      }
    }
    
    // Try to load settings from storage
    const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
    if (fs.existsSync(settingsPath)) {
      try {
        const savedSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        if (savedSettings) {
          // Apply saved settings
          if (savedSettings.maximumEntries !== undefined) {
            config.maximumEntries = savedSettings.maximumEntries;
          }
          console.log(`[MMM-StylishCalendar] Loaded settings from storage`);
        }
      } catch (error) {
        console.error(`[MMM-StylishCalendar] Error loading settings from storage:`, error);
      }
    }
    
    if (config.calendars.length > 0) {
      this.loadCalendars(instanceId);
    }
  },
  
  loadCalendars: function(instanceId) {
    const instance = this.calendarInstances[instanceId];
    if (!instance) {
      console.error(`[MMM-StylishCalendar] Instance ${instanceId} not found`);
      return;
    }
    
    // Log the calendars we're loading
    console.log(`[MMM-StylishCalendar] Loading ${instance.config.calendars.length} calendars for instance ${instanceId}`);
    console.log(`[MMM-StylishCalendar] Calendars in config: ${JSON.stringify(instance.config.calendars)}`);
    
    if (!instance.config.calendars || instance.config.calendars.length === 0) {
      console.log(`[MMM-StylishCalendar] No calendars found in config for instance ${instanceId}`);
    }
    
    instance.config.calendars.forEach(calendar => {
      if (!this.calendars[calendar.url]) {
        // Create a new calendar entry
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
        
        console.log(`[MMM-StylishCalendar] Added calendar: ${calendar.name} (${calendar.url})`);
      }
    });
  },
  
  getCalendarEvents: function(instanceId, config) {
    const instance = this.calendarInstances[instanceId];
    if (!instance) {
      console.error(`[MMM-StylishCalendar] Instance ${instanceId} not found in getCalendarEvents`);
      return;
    }
    
    console.log(`[MMM-StylishCalendar] Getting calendar events for instance ${instanceId}`);
    
    // Always check for calendar files on disk
    const calendarConfigPath = path.join(this.storagePath, `${instanceId}-calendars.json`);
    try {
      if (fs.existsSync(calendarConfigPath)) {
        const savedCalendars = JSON.parse(fs.readFileSync(calendarConfigPath, "utf8"));
        if (savedCalendars && savedCalendars.length > 0) {
          // Update config with saved calendars
          console.log(`[MMM-StylishCalendar] Loading ${savedCalendars.length} calendars from ${calendarConfigPath}`);
          
          // Force config update
          instance.config.calendars = savedCalendars;
          config.calendars = savedCalendars;
          
          // Debug output of calendars
          savedCalendars.forEach(cal => {
            console.log(`[MMM-StylishCalendar] Loaded calendar: ${cal.name} (${cal.url})`);
          });
        } else {
          console.log(`[MMM-StylishCalendar] Calendar file exists but contains no calendars: ${calendarConfigPath}`);
        }
      } else {
        console.log(`[MMM-StylishCalendar] No calendar file found at: ${calendarConfigPath}`);
      }
    } catch (error) {
      console.error(`[MMM-StylishCalendar] Error loading calendars in getCalendarEvents:`, error);
    }
    
    // Reload calendars in case they changed
    this.loadCalendars(instanceId);
    
    // Check if we actually have calendars to fetch
    if (!instance.config.calendars || instance.config.calendars.length === 0) {
      console.error(`[MMM-StylishCalendar] No calendars configured for instance ${instanceId}`);
      
      // Send empty events array to avoid loading indicator
      this.sendSocketNotification("CALENDAR_EVENTS", {
        instanceId: instanceId,
        events: []
      });
      
      return;
    }
    
    console.log(`[MMM-StylishCalendar] Fetching events from ${instance.config.calendars.length} calendars`);
    
    const promises = [];
    const now = moment();
    
    // Always fetch all calendars on each update to ensure we have the most recent data
    instance.config.calendars.forEach(calendarConfig => {
      const calendar = this.calendars[calendarConfig.url];
      
      if (!calendar) return;
      
      // Force regular updates regardless of last fetch time
      const promise = this.fetchCalendar(instanceId, calendar)
        .then(events => {
          calendar.events = events;
          calendar.lastFetched = moment();
          console.log(`[MMM-StylishCalendar] Updated calendar ${calendar.name} with ${events.length} events`);
          return events;
        })
        .catch(error => {
          console.error(`[MMM-StylishCalendar] Error fetching calendar ${calendar.name}:`, error);
          // Return cached events if available, otherwise empty array
          return calendar.events || [];
        });
      
      promises.push(promise);
    });
    
    // When all calendars are fetched, send events back
    Promise.all(promises)
      .then(results => {
        // Flatten events from all calendars
        let allEvents = [].concat(...results);
        
        // Remove any duplicate events (same title, start time and end time)
        const uniqueEvents = [];
        const eventMap = new Map();
        
        allEvents.forEach(event => {
          const key = `${event.title}_${moment(event.startDate).format('YYYY-MM-DD-HH-mm')}_${moment(event.endDate).format('YYYY-MM-DD-HH-mm')}`;
          if (!eventMap.has(key)) {
            eventMap.set(key, true);
            uniqueEvents.push(event);
          }
        });
        
        // Sort events by start date (earlier events first)
        uniqueEvents.sort((a, b) => moment(a.startDate).valueOf() - moment(b.startDate).valueOf());
        
        // Filter events based on config
        allEvents = this.filterEvents(uniqueEvents, config);
        
        console.log(`[MMM-StylishCalendar] Sending ${allEvents.length} events to instance ${instanceId}`);
        
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
    
    // Handle webcal protocol
    let url = calendar.url;
    if (url.startsWith('webcal://')) {
      url = url.replace('webcal://', 'https://');
    }
    
    return fetch(url, fetchOptions)
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
    if (!events || events.length === 0) {
      console.log(`[MMM-StylishCalendar] No events to filter`);
      return [];
    }
    
    // Default values if config is missing
    const maxDays = config.maximumDaysInFuture || 365;
    const maxEntries = config.maximumEntries || 10;
    
    console.log(`[MMM-StylishCalendar] Filtering events: ${events.length} events, max ${maxEntries} entries, ${maxDays} days ahead`);
    
    const now = moment();
    const future = moment().add(maxDays, "days");
    
    // Filter events based on date range
    const filteredEvents = events.filter(event => {
      const eventStart = moment(event.startDate);
      return eventStart.isBetween(now, future, null, "[]");
    });
    
    console.log(`[MMM-StylishCalendar] After date filtering: ${filteredEvents.length} events remain`);
    
    // Return events limited by maximumEntries count
    const limitedEvents = filteredEvents.slice(0, maxEntries);
    console.log(`[MMM-StylishCalendar] After entry limit: ${limitedEvents.length} events will be shown`);
    
    return limitedEvents;
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
    this.expressApp.get("/MMM-StylishCalendar/auth/apple-calendar", (req, res) => {
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });
    
    this.expressApp.post("/MMM-StylishCalendar/api/apple-calendar", (req, res) => {
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
        console.log(`[MMM-StylishCalendar] Calendar setup server running at http://localhost:${port}/MMM-StylishCalendar/setup`);
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