/*
 * MMM-StylishCalendar
 * MIT license
 *
 * DOM Builder for the stylish calendar
 */

/* eslint-disable no-undef */

class CalendarBuilder {
    constructor(translator, config) {
      this.translate = translator;
      this.config = config;
      this.root = document.querySelector(":root");
      
      // SVG icon paths
      this.svgs = {
        calendar: "M7,2H21C22.1,2 23,2.9 23,4V20C23,21.1 22.1,22 21,22H3C1.9,22 1,21.1 1,20V8L7,2M7,4V8H3V20H21V4H7M17,14H19V17H17V14M15,14H13V17H15V14M11,14H9V17H11V14M7,14H5V17H7V14Z",
        birthday: "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z",
        event: "M16,13C15.71,13 15.38,13.03 15.03,13.05C16.19,13.89 17,15 17,16.5V19H23V16.5C23,14.17 18.33,13 16,13M8,13C5.67,13 1,14.17 1,16.5V19H15V16.5C15,14.17 10.33,13 8,13M8,11A3,3 0 0,0 11,8A3,3 0 0,0 8,5A3,3 0 0,0 5,8A3,3 0 0,0 8,11M16,11A3,3 0 0,0 19,8A3,3 0 0,0 16,5A3,3 0 0,0 13,8A3,3 0 0,0 16,11Z",
        work: "M10,2H14A2,2 0 0,1 16,4V6H20A2,2 0 0,1 22,8V19A2,2 0 0,1 20,21H4C2.89,21 2,20.1 2,19V8C2,6.89 2.89,6 4,6H8V4C8,2.89 8.89,2 10,2M14,6V4H10V6H14Z",
        travel: "M2.5,19H21.5V21H2.5V19M22.07,9.64C21.86,8.84 21.03,8.36 20.23,8.58L14.92,10L8,7.67L3.8,9.35L5.8,13.13L8.97,12.11L10.93,12.95L2.45,16.16L3.22,18.08L13.47,14.13L17.5,18.35L19,17.66L15.56,12.26L20.5,10.95C21.3,10.74 21.77,9.9 21.56,9.11L22.07,9.64Z",
        holiday: "M8,17.85C8,19.04 7.11,20 6,20C4.89,20 4,19.04 4,17.85C4,16.42 6,14 6,14C6,14 8,16.42 8,17.85M16.46,12V10.54L8.46,5.54L7.04,7.46L13.54,11.46H3V13.46H13.54L7.04,17.46L8.46,19.38L16.46,14.38V12.92L18.04,14V10L16.46,12Z",
        meeting: "M17,12V3A1,1 0 0,0 16,2H3A1,1 0 0,0 2,3V17L6,13H16A1,1 0 0,0 17,12M21,6H19V15H6V17A1,1 0 0,0 7,18H18L22,22V7A1,1 0 0,0 21,6Z",
        location: "M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z",
        description: "M3,9H17V7H3V9M3,13H17V11H3V13M3,17H17V15H3V17M19,17H21V15H19V17M19,7V9H21V7H19M19,13H21V11H19V13Z",
        time: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
        family: "M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z"
      };
      
      // Calendar color palette
      this.calendarColors = [
        "#ca5010", // Main theme color
        "#3498db", // Blue
        "#2ecc71", // Green
        "#9b59b6", // Purple
        "#e74c3c", // Red
        "#f1c40f", // Yellow
        "#1abc9c", // Teal
        "#e67e22", // Orange
        "#34495e", // Dark Blue
        "#16a085", // Dark Teal
      ];
    }
  
    buildCalendar(events, config) {
      const container = document.createElement("div");
      container.className = "calendar-container";
      
      // Add header if enabled
      if (config.showHeader) {
        container.appendChild(this.buildHeader());
      }
      
      // Build content based on selected mode
      if (config.mode === "month") {
        container.appendChild(this.buildMonthView(events));
      } else if (config.mode === "week") {
        container.appendChild(this.buildWeekView(events));
      } else if (config.mode === "day") {
        container.appendChild(this.buildDayView(events));
      } else {
        // Default: upcoming view
        container.appendChild(this.buildUpcomingView(events));
      }
      
      return container;
    }
    
    buildHeader() {
      const header = document.createElement("div");
      header.className = "calendar-header";
      
      const title = document.createElement("div");
      title.className = "calendar-title";
      
      // Add icon
      const iconContainer = document.createElement("div");
      iconContainer.className = "calendar-icon";
      
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", this.svgs.calendar);
      path.setAttribute("fill", "currentColor");
      
      svg.appendChild(path);
      iconContainer.appendChild(svg);
      
      // Add title
      const titleText = document.createElement("span");
      titleText.textContent = this.translate("CALENDAR");
      
      title.appendChild(iconContainer);
      title.appendChild(titleText);
      
      const dateInfo = document.createElement("div");
      //dateInfo.className = "calendar-date-info";
      //dateInfo.textContent = moment().format("dddd, MMMM Do");
      
      header.appendChild(title);
      header.appendChild(dateInfo);
      
      return header;
    }
    
    buildUpcomingView(events) {
      const container = document.createElement("div");
      container.className = "calendar-upcoming-view";
      
      // Group events by day if configured
      if (this.config.groupByDay) {
        const eventsByDay = this.groupEventsByDay(events);
        const dayLimit = this.config.dayLimit || 7;
        let daysAdded = 0;
        
        // Add each day group
        for (const [day, dayEvents] of Object.entries(eventsByDay)) {
          if (daysAdded >= dayLimit) break;
          
          const dayContainer = this.buildDayGroup(day, dayEvents);
          container.appendChild(dayContainer);
          daysAdded++;
        }
      } else {
        // Just list all events without grouping
        events.forEach(event => {
          const eventElement = this.buildEventElement(event);
          container.appendChild(eventElement);
        });
      }
      
      return container;
    }
    
    buildDayGroup(day, events) {
      const dayContainer = document.createElement("div");
      dayContainer.className = "calendar-day-group";
      
      // Add day header
      const dayHeader = document.createElement("div");
      dayHeader.className = "day-header";
      
      const dayName = document.createElement("div");
      dayName.className = "day-name";
      
      // Format the day in a more readable way
      const dayDate = moment(day, "YYYY-MM-DD");
      const isToday = dayDate.isSame(moment(), "day");
      
      if (isToday) {
        dayName.textContent = this.translate("TODAY");
        dayName.classList.add("today");
      } else if (dayDate.isSame(moment().add(1, "day"), "day")) {
        dayName.textContent = this.translate("TOMORROW");
      } else {
        dayName.textContent = dayDate.format("dddd");
      }
      
      const dayDateElement = document.createElement("div");
      dayDateElement.className = "day-date";
      dayDateElement.textContent = dayDate.format(this.config.dateFormat);
      
      dayHeader.appendChild(dayName);
      dayHeader.appendChild(dayDateElement);
      dayContainer.appendChild(dayHeader);
      
      // Add events for this day
      const dayEvents = document.createElement("div");
      dayEvents.className = "day-events";
      
      events.forEach(event => {
        const eventElement = this.buildEventElement(event);
        dayEvents.appendChild(eventElement);
      });
      
      dayContainer.appendChild(dayEvents);
      return dayContainer;
    }
    
    buildEventElement(event) {
      const eventElement = document.createElement("div");
      eventElement.className = "calendar-event";
      
      if (this.config.colorizeEvents) {
        // Use the custom calendar color if available, otherwise generate one
        let eventColor;
        if (event.calendarColor) {
          eventColor = event.calendarColor;
        } else {
          // Assign a consistent color based on calendar name
          const calendarIndex = Math.abs(this.hashString(event.calendarName)) % this.calendarColors.length;
          eventColor = this.calendarColors[calendarIndex];
        }
        eventElement.style.setProperty("--event-color", eventColor);
      }
      
      if (event.fullDayEvent) {
        eventElement.classList.add("full-day-event");
      }
      
      // Add event time
      if (!event.fullDayEvent) {
        const eventTime = document.createElement("div");
        eventTime.className = "event-time";
        
        const timeFormat = this.config.timeFormat === 24 ? "HH:mm" : "h:mm A";
        const startTime = moment(event.startDate).format(timeFormat);
        
        let timeText = startTime;
        
        // Add end time if showing duration is enabled
        if (this.config.showEventDuration) {
          const endTime = moment(event.endDate).format(timeFormat);
          const duration = moment.duration(moment(event.endDate).diff(moment(event.startDate)));
          const hours = duration.hours();
          const minutes = duration.minutes();
          
          if (hours > 0 || minutes > 0) {
            timeText += ` - ${endTime}`;
          }
        }
        
        eventTime.textContent = timeText;
        eventElement.appendChild(eventTime);
      }
      
      // Add calendar symbol/icon and category
      if (this.config.displaySymbol) {
        const symbolContainer = document.createElement("div");
        symbolContainer.className = "event-symbol";
        
        // Get the calendar symbol or default
        const symbol = event.calendarSymbol || this.config.defaultSymbol;
        
        // Use icon replacement if available
        if (this.config.displaySymbolIconReplacement && this.svgs[symbol]) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "0 0 24 24");
          
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", this.svgs[symbol]);
          path.setAttribute("fill", "currentColor");
          
          svg.appendChild(path);
          symbolContainer.appendChild(svg);
        } else {
          symbolContainer.textContent = symbol;
        }
        
        // Add category if available
        if (event.calendarCategory) {
          const categorySpan = document.createElement("span");
          categorySpan.className = "event-category";
          categorySpan.textContent = event.calendarCategory;
          symbolContainer.appendChild(categorySpan);
        }
        
        eventElement.appendChild(symbolContainer);
      }
      
      // Create content wrapper
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "event-content";
      
      // Add event title
      const title = document.createElement("div");
      title.className = "event-title";
      
      // Truncate title if needed
      let titleText = event.title;
      if (titleText.length > this.config.maxEventTitleLength) {
        titleText = titleText.substring(0, this.config.maxEventTitleLength) + "...";
      }
      
      title.textContent = titleText;
      contentWrapper.appendChild(title);
      
      // Add location if available and enabled
      if (this.config.showLocation && event.location) {
        const location = document.createElement("div");
        location.className = "event-location";
        
        // Create location icon
        const locationIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        locationIcon.setAttribute("viewBox", "0 0 24 24");
        locationIcon.classList.add("location-icon");
        
        const locationPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        locationPath.setAttribute("d", this.svgs.location);
        locationPath.setAttribute("fill", "currentColor");
        
        locationIcon.appendChild(locationPath);
        
        // Truncate location if needed
        let locationText = event.location;
        if (locationText.length > this.config.maxEventLocationLength) {
          locationText = locationText.substring(0, this.config.maxEventLocationLength) + "...";
        }
        
        location.appendChild(locationIcon);
        location.appendChild(document.createTextNode(locationText));
        contentWrapper.appendChild(location);
      }
      
      // Add description if available and enabled
      if (this.config.showDescription && event.description) {
        const description = document.createElement("div");
        description.className = "event-description";
        description.textContent = event.description.substring(0, 50) + (event.description.length > 50 ? "..." : "");
        contentWrapper.appendChild(description);
      }
      
      eventElement.appendChild(contentWrapper);
      return eventElement;
    }
    
    buildMonthView(events) {
      // Placeholder for future implementation
      const container = document.createElement("div");
      container.className = "calendar-month-view";
      container.textContent = "Month view coming soon...";
      return container;
    }
    
    buildWeekView(events) {
      // Placeholder for future implementation
      const container = document.createElement("div");
      container.className = "calendar-week-view";
      container.textContent = "Week view coming soon...";
      return container;
    }
    
    buildDayView(events) {
      // Placeholder for future implementation
      const container = document.createElement("div");
      container.className = "calendar-day-view";
      container.textContent = "Day view coming soon...";
      return container;
    }
    
    // Helper methods
    groupEventsByDay(events) {
      const eventsByDay = {};
      
      events.forEach(event => {
        const day = moment(event.startDate).format("YYYY-MM-DD");
        
        if (!eventsByDay[day]) {
          eventsByDay[day] = [];
        }
        
        eventsByDay[day].push(event);
      });
      
      return eventsByDay;
    }
    
    hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      return hash;
    }
  }