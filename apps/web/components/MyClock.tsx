"use client";

import React, { useState, useEffect } from "react";

const CustomClock = ({
  format = "HH:mm:ss",
  timezone = "UTC",
  ticking = false,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!ticking) return;

    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [ticking]);

  // Format the time according to the specified timezone
  const formatTimeWithTimezone = () => {
    // Create options for toLocaleString based on format
    const options = {
      timeZone: timezone,
      hour12: false, // Use 24-hour format
    };

    const timeString = time.toLocaleString("en-US", options);
    const dateObj = new Date(timeString);

    const hours = dateObj.getHours().toString().padStart(2, "0");
    const minutes = dateObj.getMinutes().toString().padStart(2, "0");
    const seconds = dateObj.getSeconds().toString().padStart(2, "0");

    if (format === "HH:mm:ss") {
      return `${hours}:${minutes}:${seconds}`;
    } else if (format === "HH:mm") {
      return `${hours}:${minutes}`;
    }

    return dateObj.toLocaleTimeString();
  };

  return <span>{formatTimeWithTimezone()}</span>;
};

export default function MyClock() {
  const [isMounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isMounted) {
    return <span>Loading...</span>;
  }

  return (
    <div className="dark:bg-primary-foreground rounded-md border border-gray-700/10 bg-gray-100 px-2 py-1 font-mono text-black dark:border-gray-200/10 dark:text-white">
      <CustomClock
        format={"HH:mm:ss"}
        ticking={true}
        timezone={"Asia/Ho_Chi_Minh"}
      />
    </div>
  );
}
