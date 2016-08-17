#include "LPD8806.h"
#include "SPI.h" // Comment out this line if using Trinket or Gemma
#ifdef __AVR_ATtiny85__
 #include <avr/power.h>
#endif 
#include <WiFi101.h>
#include <aREST.h>

// Example to control LPD8806-based RGB LED Modules in a strip

/*****************************************************************************/

// Number of RGB LEDs in strand:
int nLEDs = 48;

// Chose 2 pins for output; can be any valid output pins:
int dataPin  = 4;
int clockPin = 5;

// First parameter is the number of LEDs in the strand.  The LED strips
// are 32 LEDs per meter but you can extend or cut the strip.  Next two
// parameters are SPI data and clock pins:
LPD8806 strip = LPD8806(nLEDs, dataPin, clockPin);

// You can optionally use hardware SPI for faster writes, just leave out
// the data and clock pin parameters.  But this does limit use to very
// specific pins on the Arduino.  For "classic" Arduinos (Uno, Duemilanove,
// etc.), data = pin 11, clock = pin 13.  For Arduino Mega, data = pin 51,
// clock = pin 52.  For 32u4 Breakout Board+ and Teensy, data = pin B2,
// clock = pin B1.  For Leonardo, this can ONLY be done on the ICSP pins.
//LPD8806 strip = LPD8806(nLEDs);

/* wifi */
// Status
int status = WL_IDLE_STATUS;

// Create aREST instance
aREST rest = aREST();

// WiFi parameters
char ssid[] = "2400 Nueces Wireless";

// The port to listen for incoming TCP connections
#define LISTEN_PORT           80

// Create an instance of the server
WiFiServer server(LISTEN_PORT);

// Variables to be exposed to the API
int temperature;
int humidity;
int curWait;
uint32_t curColor;
String strColor;
int curAnimation;
String strAnimation;

// Declare functions to be exposed to the API
int ledControl(String command);
/* end wifi */


void setup() {
#if defined(__AVR_ATtiny85__) && (F_CPU == 16000000L)
  clock_prescale_set(clock_div_1); // Enable 16 MHz on Trinket
#endif

  // Start up the LED strip
  strip.begin();

  // Update the strip, to start they are all 'off'
  strip.show();

  // Start Serial
  Serial.begin(115200);

  // Init variables and expose them to REST API
  temperature = 24;
  humidity = 40;
  curWait = 5;
  strColor = "blue"; 
  curAnimation = -1;
  strAnimation = "colorWipe (default)";
  curColor = strip.Color(0, 0, 127); // Blue
  rest.variable("wait", &curWait);
  rest.variable("color", &strColor);
  rest.variable("animation", &strAnimation);

  // Function to be exposed
  rest.function("setanimation",setAnimation);
  rest.function("setwait", setWait);
  rest.function("setcolor", setColor);

  // Give name and ID to device (ID should be 6 characters long)
  rest.set_id("1");
  rest.set_name("mkr1000");

  // Connect to WiFi
  while (status != WL_CONNECTED) {
    Serial.print("Attempting to connect to SSID: ");
    Serial.println(ssid);
    status = WiFi.begin(ssid);

    // Wait 10 seconds for connection:
    delay(10000);
  }
  Serial.println("WiFi connected");

  // Start the server
  server.begin();
  Serial.println("Server started");

  // Print the IP address
  IPAddress ip = WiFi.localIP();
  Serial.print("IP Address: ");
  Serial.println(ip);
}


void loop() {
  // Handle REST calls
  WiFiClient client = server.available();
  if (!client) {
    // This where we want to do the last known call
    Serial.println("waiting on client -- Resuming: " + strAnimation);
    executeAnimation(curAnimation);
    delay(500);    return;
  }
  while(!client.available()){
    delay(1);
  }
  rest.handle(client);
  Serial.println("itteration");
  delay(1000);
}

void rainbow(uint8_t wait) {
  int i, j;
   
  for (j=0; j < 384; j++) {     // 3 cycles of all 384 colors in the wheel
    for (i=0; i < strip.numPixels(); i++) {
      strip.setPixelColor(i, Wheel( (i + j) % 384));
    }  
    strip.show();   // write all the pixels out
    delay(wait);
  }
}

// Slightly different, this one makes the rainbow wheel equally distributed 
// along the chain
void rainbowCycle(uint8_t wait) {
  uint16_t i, j;
  
  for (j=0; j < 384 * 5; j++) {     // 5 cycles of all 384 colors in the wheel
    for (i=0; i < strip.numPixels(); i++) {
      // tricky math! we use each pixel as a fraction of the full 384-color wheel
      // (thats the i / strip.numPixels() part)
      // Then add in j which makes the colors go around per pixel
      // the % 384 is to make the wheel cycle around
      strip.setPixelColor(i, Wheel( ((i * 384 / strip.numPixels()) + j) % 384) );
    }  
    strip.show();   // write all the pixels out
    delay(wait);
  }
}

// Fill the dots progressively along the strip.
void colorWipe(uint32_t c, uint8_t wait) {
  int i;

  for (i=0; i < strip.numPixels(); i++) {
      strip.setPixelColor(i, c);
      strip.show();
      delay(wait);
  }
}

// Chase one dot down the full strip.
void colorChase(uint32_t c, uint8_t wait) {
  int i;

  // Start by turning all pixels off:
  for(i=0; i<strip.numPixels(); i++) strip.setPixelColor(i, 0);

  // Then display one pixel at a time:
  for(i=0; i<strip.numPixels(); i++) {
    strip.setPixelColor(i, c); // Set new pixel 'on'
    strip.show();              // Refresh LED states
    strip.setPixelColor(i, 0); // Erase pixel, but don't refresh!
    delay(wait);
  }

  strip.show(); // Refresh to turn off last pixel
}

//Theatre-style crawling lights.
void theaterChase(uint32_t c, uint8_t wait) {
  for (int j=0; j<10; j++) {  //do 10 cycles of chasing
    for (int q=0; q < 3; q++) {
      for (int i=0; i < strip.numPixels(); i=i+3) {
        strip.setPixelColor(i+q, c);    //turn every third pixel on
      }
      strip.show();
     
      delay(wait);
     
      for (int i=0; i < strip.numPixels(); i=i+3) {
        strip.setPixelColor(i+q, 0);        //turn every third pixel off
      }
    }
  }
}

//Theatre-style crawling lights with rainbow effect
void theaterChaseRainbow(uint8_t wait) {
  for (int j=0; j < 384; j++) {     // cycle all 384 colors in the wheel
    for (int q=0; q < 3; q++) {
        for (int i=0; i < strip.numPixels(); i=i+3) {
          strip.setPixelColor(i+q, Wheel( (i+j) % 384));    //turn every third pixel on
        }
        strip.show();
       
        delay(wait);
       
        for (int i=0; i < strip.numPixels(); i=i+3) {
          strip.setPixelColor(i+q, 0);        //turn every third pixel off
        }
    }
  }
}
/* Helper functions */

//Input a value 0 to 384 to get a color value.
//The colours are a transition r - g -b - back to r

uint32_t Wheel(uint16_t WheelPos)
{
  byte r, g, b;
  switch(WheelPos / 128)
  {
    case 0:
      r = 127 - WheelPos % 128;   //Red down
      g = WheelPos % 128;      // Green up
      b = 0;                  //blue off
      break; 
    case 1:
      g = 127 - WheelPos % 128;  //green down
      b = WheelPos % 128;      //blue up
      r = 0;                  //red off
      break; 
    case 2:
      b = 127 - WheelPos % 128;  //blue down 
      r = WheelPos % 128;      //red up
      g = 0;                  //green off
      break; 
  }
  return(strip.Color(r,g,b));
}

void executeAnimation(int id) {
  switch(id) {
    case 1:
      rainbow(curWait);
      strAnimation = "rainbow";
      curAnimation = 1;
      break;
    case 2:
      colorChase(curColor, curWait);
      strAnimation = "colorChase";
      curAnimation = 2;
      break;
    case 3:
      theaterChase(curColor, curWait);
      strAnimation = "theaterChase";
      curAnimation = 3;
      break;
    case 4:
      colorWipe(curColor, curWait);
      strAnimation = "colorWipe";
      curAnimation = 4;
      break;
    case 5:
      rainbowCycle(curWait);
      strAnimation = "rainbowCycle";
      curAnimation = 5;
      break;
    case 6:
      theaterChaseRainbow(curWait);
      strAnimation = "theaterChaseRainbow";
      curAnimation = 6;
      break;
    default:
      colorWipe(curColor, curWait);
      strAnimation = "colorWipe (default)";
      curAnimation = -1;
      break;
  }
}

/* ----------------------_WIFI_---------------------*/
// Custom function accessible by the API
int setAnimation(String command) {
  Serial.println("changing the current strip animation: "  + command);
  int state = command.toInt();
  executeAnimation(state);
  return 1;
}

int setWait(String command) {
  int state = command.toInt();
  Serial.print("Changeing to state: " + command);
  curWait = state;
  return 1;
}

int setColor(String color) {
  if (color.equals("white")) {
    curColor = strip.Color(127, 127, 127);
    strColor = "white";
  } else if (color.equals("red")) {
    curColor = strip.Color(127, 0, 0);
    strColor = "red";
  } else if (color.equals("yellow")) {
    curColor = strip.Color(127, 127, 0);
    strColor = "yellow";
  } else if (color.equals("green")) {
    curColor = strip.Color(0, 127, 0);
    strColor = "green";
  } else if (color.equals("cyan")) {
    curColor = strip.Color(0, 127, 127);
    strColor = "cyan";
  } else if (color.equals("blue")) {
    curColor = strip.Color(0, 0, 127);
    strColor = "blue";
  } else if (color.equals("purple")) {
    curColor = strip.Color(127, 0, 127);
    strColor = "purple";
  } else {
    return 0;
  }
  return 1;
}

