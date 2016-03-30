## Rasterize webpage for screensaver

phantomjs --ssl-protocol=tlsv1 --ignore-ssl-errors=true rasterize.js

## INSTALLATION

```
sudo raspi-config; ## Boot Options - console, and login required 
sudo apt-get install imagemagick
sudo apt-get install ttf-mscorefonts-installer ttf-liberation fonts-liberation fonts-uralic ttf-root-installer ttf-freefont fonts-linuxlibertine ttf-staypuft
sudo ln -s /etc/fonts/conf.avail/10-autohint.conf /etc/fonts/conf.d/
sudo dpkg-reconfigure fontconfig-config && sudo dpkg-reconfigure fontconfig && sudo fc-cache -fv
```
reboot (sudo init 6)


Sadly, phantomjs seems to have memory/file handle issues with long running javascript pages.  So ideally you will want to run this similar to the example.batch file.  Doing so will automatically restart anytime phantomjs crashes with a memory issue.

You can create a "wall.ini" file to have the script cycle through multiple URLs

example file
```
time=60
url=https://www.example.com
time=20
url=https://www.fred.com/script.cgi?arg=1&arg=2
```
