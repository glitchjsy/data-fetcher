<img src="https://i.imgur.com/1cXD3b0.png">

# [Open Data (Fetcher)](https://data.glitch.je)
[![Hits](https://hitcount.dev/p/glitchjsy/data-fetcher.svg)](https://hitcount.dev/p/glitchjsy/data-fetcher)  
A program to periodically fetch data to be stored permanently in MySQL or temproarily in Redis.

## Current Tasks
* **Product recalls**  
Scrapes product recalls from a page on gov.je and saves the data in redis.

* **Eat safe ratings**  
Fetches eat safe ratings and finds the latitude and longitude based on the address provided (if applicable) then saves the data in redis. 
Data is fetched every 2 days latitude / longitude are cached for 2 weeks before fetching again to check it is up to date.

* **Parking spaces**  
Fetches parking space information and then:
  1. Saves the data in redis
  2. Stores basic information in mysql to allow tracking available spaces over time

* **Customer & Local Services Queue Times**
Fetches queue information for C&LS and saves the data in redis and MySQL for tracking over time.

* **Freedom of Information Requests**
Fetches FOI requests and stores in MySQL for easy searching.