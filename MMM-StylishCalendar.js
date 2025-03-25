/*
 * MMM-StylishCalendar
 * MIT license
 *
 * A stylish, minimalistic calendar module for MagicMirror²
 */

"use strict";

Module.register("MMM-StylishCalendar", {
  defaults: {
    name: "MMM-StylishCalendar",
    
    // Calendar configuration
    calendars: [],
    maximumEntries: 10,
    displaySymbol: true,
    defaultSymbol: "calendar",
    displaySymbolIconReplacement: true,
    maxTitleLength: 30,
    wrapEvents: false,
    maxEventTitleLength: 30,
    maxEventLocationLength: 30,
    allowWebcal: true,
    
    // Appearance
    animateIn: true,
    fadeAnimations: true,
    textAnimations: true,
    transitionAnimations: true,
    colorizeEvents: true,
    roundedCorners: true,
    showLocation: true,
    showDescription: false,
    showEventDuration: true,
    
    // Apple calendar specific settings
    appleCalendarIntegration: true,
    calendarServerPort: 8200,
    
    // Locale settings - defaults to system locale
    language: config.language,
    timeFormat: config.timeFormat,
    dateFormat: "MMM Do",
    
    // View options
    mode: "upcoming", // "upcoming", "month", "week", "day"
    showHeader: true,
    groupByDay: true,
    dayLimit: 7,
    
    // Update intervals (seconds)
    updateInterval: 60,
    updateIntervalHidden: 180,
    
    // Advanced theming
    themeColor: "#ca5010",
    experimentalCSSOverridesForMM2: false,
  },

  start: function() {
    this.logBadge();
    
    this.loaded = false;
    this.events = [];
    this.isHidden = false;
    this.currentIntervalId = null;
    this.authenticationRunning = false;
    this.firstFetch = true;
    
    this.moduleVersion = "1.0.0";
    
    // Create stable ID for this instance based on module position
    const positionKey = this.data.position || "unknown";
    this.instanceId = `mm-stylish-calendar-${positionKey.replace("_", "-")}`;
    console.log(`[${this.name}] Starting module with instance ID: ${this.instanceId}`);
    
    // Send credentials to backend and start update cycle
    this.sendConfig();
    this.updateCalendarEvents();
    this.scheduleUpdate();
    
    // Setup some useful CSS variables
    this.root = document.querySelector(":root");
    this.setupThemeColors();
  },
  
  getStyles: function() {
    return [
      this.file("css/MMM-StylishCalendar.css")
    ];
  },
  
  getTranslations: function() {
    return {
      en: "translations/en.json",
      de: "translations/de.json",
    };
  },
  
  getScripts: function() {
    return [
      "moment.js",
      this.file("vendor/vibrant.worker.min.js"),
      this.file("utils/CalendarBuilder.js")
    ];
  },
  
  getDom: function() {
    // Create main wrapper with module styling
    const wrapper = document.createElement("div");
    wrapper.className = "MMM-StylishCalendar-wrapper";
    
    if (!this.loaded) {
      // Show loading message
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.className = "MMM-StylishCalendar-wrapper dimmed";
      console.log(`[${this.name}] Calendar loading - awaiting events from backend`);
      return wrapper;
    }
    
    if (this.events.length === 0) {
      // No events to display
      if (!this.config.calendars || this.config.calendars.length === 0) {
        // No calendars configured
        wrapper.innerHTML = `<div style="color:yellow">No calendars configured.<br>Visit http://localhost:8080/MMM-StylishCalendar/setup<br>to add calendars.</div>`;
        wrapper.className = "MMM-StylishCalendar-wrapper dimmed";
        console.log(`[${this.name}] No calendars configured`);
      } else {
        // Calendars configured but no events
        wrapper.innerHTML = this.translate("NO_EVENTS");
        wrapper.className = "MMM-StylishCalendar-wrapper dimmed";
        console.log(`[${this.name}] No events to display - ${this.config.calendars.length} calendars but events array is empty`);
      }
      return wrapper;
    }
    
    console.log(`[${this.name}] Rendering ${this.events.length} events`);
    
    // If calendars is empty, there might be an issue with config
    if (!this.config.calendars || this.config.calendars.length === 0) {
      console.log(`[${this.name}] Warning: No calendars in config, but ${this.events.length} events loaded`);
    }
    
    // Build calendar based on selected mode
    const calendarDom = this.builder.buildCalendar(this.events, this.config);
    wrapper.appendChild(calendarDom);
    
    return wrapper;
  },
  
  socketNotificationReceived: function(notification, payload) {
    if (notification === "CALENDAR_EVENTS") {
      if (payload.instanceId === this.instanceId) {
        console.log(`[${this.name}] Received ${payload.events.length} events from backend`);
        this.events = payload.events;
        this.loaded = true;
        this.updateDom();
      }
    } else if (notification === "CALENDAR_UPDATED") {
      if (payload.instanceId === this.instanceId) {
        console.log(`[${this.name}] Calendar config updated with ${payload.calendars.length} calendars`);
        this.config.calendars = payload.calendars;
        this.sendConfig();
        this.updateCalendarEvents();
      }
    } else if (notification === "SETTINGS_UPDATED") {
      if (payload.instanceId === this.instanceId) {
        if (payload.settings.maximumEntries) {
          this.config.maximumEntries = payload.settings.maximumEntries;
        }
        this.sendConfig();
        this.updateCalendarEvents();
      }
    } else if (notification === "APPLE_CALENDAR_AUTH_RUNNING") {
      if (payload.instanceId === this.instanceId) {
        this.authenticationRunning = true;
        console.info(`[${this.name}] Apple Calendar authentication server running at: http://localhost:${this.config.calendarServerPort}/`);
      }
    } else if (notification === "APPLE_CALENDAR_AUTH_SUCCESS") {
      if (payload.instanceId === this.instanceId) {
        this.config.calendars = this.config.calendars.concat(payload.calendars);
        this.sendConfig();
        this.updateCalendarEvents();
      }
    } else if (notification === "APPLE_CALENDAR_AUTH_FAILED") {
      if (payload.instanceId === this.instanceId) {
        console.error(`[${this.name}] Apple Calendar authentication failed: ${payload.error}`);
      }
    }
  },
  
  notificationReceived: function(notification, payload, sender) {
    if (notification === "MODULE_DOM_CREATED") {
      this.builder = new CalendarBuilder(
        this.translate,
        this.config
      );
    } else if (notification === "CALENDAR_EVENTS") {
      this.events = payload;
      this.loaded = true;
      this.updateDom();
    }
  },
  
  suspend: function() {
    this.isHidden = true;
    this.scheduleUpdate();
  },
  
  resume: function() {
    this.isHidden = false;
    this.scheduleUpdate();
    this.updateDom();
  },
  
  /* Helper Methods */
  
  scheduleUpdate: function() {
    const self = this;
    clearInterval(this.currentIntervalId);
    
    const interval = this.isHidden 
      ? this.config.updateIntervalHidden 
      : this.config.updateInterval;
    
    this.currentIntervalId = setInterval(function() {
      self.updateCalendarEvents();
    }, interval * 1000);
  },
  
  updateCalendarEvents: function() {
    this.sendSocketNotification("GET_CALENDAR_EVENTS", {
      instanceId: this.instanceId,
      config: this.config
    });
  },
  
  sendConfig: function() {
    this.sendSocketNotification("INIT_CALENDAR", {
      instanceId: this.instanceId,
      config: this.config
    });
  },
  
  setupThemeColors: function() {
    const color = this.config.themeColor;
    
    // Set main theme color
    this.root.style.setProperty("--calendar-theme-color", color);
    
    // Calculate variants
    this.root.style.setProperty("--calendar-theme-color-light", this.lightenColor(color, 20));
    this.root.style.setProperty("--calendar-theme-color-dark", this.darkenColor(color, 20));
  },
  
  lightenColor: function(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return "#" + (
      0x1000000 + 
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  },
  
  darkenColor: function(color, percent) {
    return this.lightenColor(color, -percent);
  },
  
  logBadge: function() {
    console.log(
      ` ⠖ %c MMM-StylishCalendar %c ${this.moduleVersion}`,
      "background-color: #555; color: #fff; margin: 0.4em 0em 0.4em 0.4em; padding: 5px 5px 5px 5px; border-radius: 7px 0 0 7px; font-family: DejaVu Sans, Verdana, Geneva, sans-serif;",
      "background-color: #ca5010; color: #fff; margin: 0.4em 0.4em 0.4em 0em; padding: 5px 5px 5px 5px; border-radius: 0 7px 7px 0; font-family: DejaVu Sans, Verdana, Geneva, sans-serif; text-shadow: 0 1px 0 rgba(1, 1, 1, 0.3)"
    );
  }
});