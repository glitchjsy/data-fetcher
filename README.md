<img src="https://i.imgur.com/1cXD3b0.png">

# [Open Data (Fetcher)](https://data.glitch.je)
A program to periodically fetch data to be stored permanently in MySQL or temproarily in Redis.

## Current Tasks
* **Product recalls**  
Scrapes product recalls from a page on gov.je and saves the data in redis.

* **Eat safe ratings**  
Fetches eat safe ratings and finds the latitude and longitude based on the address provided (if applicable) then saves the data in redis.

* **Parking spaces**  
Fetches parking space information and then:
  1. Saves the data in redis
  2. Stores basic information in mysql to allow tracking available spaces over time