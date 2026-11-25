# Water Refilling Station System

A management system for a water refilling station, built with HTML, CSS, and JavaScript. Track customers, gallon deliveries, borrowed containers, and utang in one place.

**Live preview:**

## Features

- Customers with contact details, search, and filters for utang and containers
- Delivery log with price per gallon, empties collected, and payment at delivery
- Automatic container tracking: shows how many containers each customer still holds
- Utang per customer, with the age of the oldest unpaid delivery
- Payment recording that settles the oldest balance first
- Dashboard with sales, collections, total utang, containers out, and a 7-day chart
- Undo for every change, CSV export, and adjustable station name and price
- Data saved in the browser (localStorage)

## Run locally

The app uses ES modules, so serve the folder with a static server such as the VS Code Live Server extension.

## Project structure

```
water-refilling-system/
├── index.html
├── css/style.css
└── js/
    ├── app.js
    ├── render.js
    └── store.js
```