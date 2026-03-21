# B2B & B2C Bakery Autonomous Telegram Bot

An advanced, fully autonomous Telegram bot built with TypeScript and Node.js to manage both wholesale (B2B) and retail (B2C) operations for a bakery/pastry business. It handles product catalogs, cart management, automated order routing, and historical data synchronization via Google Sheets.

## Key Features

* **Dual-Flow Architecture:** Distinct user experiences and menus for Retail Customers and Wholesale Partners.
* **Secure B2B Authorization:** Phone number verification mechanism to grant access to wholesale prices and features.
* **Dynamic Cart System:** Session-based state management for adding items, adjusting quantities, and placing bulk orders.
* **Google Sheets Integration:** Fetches historical order data from Google Sheets, allowing wholesale partners to seamlessly repeat previous orders with one click.
* **Visual Catalogs:** Utilizes Telegram's Media Group API to display seamless photo albums for menus and price lists without database overhead.
* **Admin Dashboard & Notifications:** Real-time Telegram alerts for admins regarding new partnerships, incoming orders, and customer support queries.

## Tech Stack

* **Language:** TypeScript / Node.js
* **Bot Framework:** [Telegraf](https://telegraf.js.org/) (Telegram Bot API)
* **Database / ORM:** [Prisma ORM](https://www.prisma.io/)
* **External APIs:** Google Sheets API, Google Auth Library
* **Deployment & Process Management:** Ubuntu VPS, PM2

Telegram: @DOSTAVKA_hliby_bot



