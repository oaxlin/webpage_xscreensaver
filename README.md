## Rasterize webpage for screensaver

phantomjs --ssl-protocol=tlsv1 --ignore-ssl-errors=true rasterize.js

## INSTALLATION

Install your favorite linux pi flavor.  I used debian.

```
sudo raspi-config; ## Boot Options - console, and login required 
sudo apt-get install imagemagick git
sudo apt-get install ttf-mscorefonts-installer ttf-liberation fonts-liberation fonts-uralic ttf-root-installer ttf-freefont fonts-linuxlibertine ttf-staypuft
sudo ln -s /etc/fonts/conf.avail/10-autohint.conf /etc/fonts/conf.d/
sudo dpkg-reconfigure fontconfig-config && sudo dpkg-reconfigure fontconfig && sudo fc-cache -fv
git clone https://github.com/oaxlin/webpage_xscreensaver.git
```
reboot (sudo init 6)

Sadly, phantomjs seems to have memory/file handle issues with long running javascript pages.  So ideally you will want to run this similar to the example.batch file.  Doing so will automatically restart anytime phantomjs crashes with a memory issue.

## wall.ini

You can create a "wall.ini" file to have the script display a single page, or cycle through multiple URLs

Example file
```
time=60
url=https://www.example.com
time=20
url=https://www.fred.com/script.cgi?arg=1&arg=2
```
