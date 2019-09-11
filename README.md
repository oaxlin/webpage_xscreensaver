## Rasterize webpage for screensaver

phantomjs --ssl-protocol=tlsv1 --ignore-ssl-errors=true rasterize.js

## INSTALLATION

Install your favorite linux pi flavor.  I used ubuntu mate.

```
sudo systemctl set-default multi-user.target --force
sudo systemctl disable lightdm.service --force
sudo systemctl disable graphical.target --force
sudo systemctl disable plymouth.service --force
sudo systemctl enable ssh
sudo apt-get install imagemagick git fbi
sudo apt-get install ttf-mscorefonts-installer ttf-liberation fonts-liberation
sudo apt-get install fonts-uralic ttf-root-installer ttf-freefont fonts-linuxlibertine ttf-staypuft
sudo ln -s /etc/fonts/conf.avail/10-autohint.conf /etc/fonts/conf.d/
sudo dpkg-reconfigure fontconfig-config && sudo dpkg-reconfigure fontconfig && sudo fc-cache -fv
git clone https://github.com/oaxlin/webpage_xscreensaver.git
wget http://security.debian.org/debian-security/pool/updates/main/i/icu/libicu48_4.8.1.1-12+deb7u7_armhf.deb
sudo dpkg -i libicu48_4.8.1.1-12+deb7u7_armhf.deb
sudo cp webpage_xscreensaver/wallboard.init /etc/init.d/wallboard

curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt install chromium-browser chromium-codecs-ffmpeg
cd ~/webpage_xscreensaver
npm i -S puppeteer-core

sudo ln -s /etc/init.d/wallboard /etc/rc3.d/S05wallboard
sudo ln -s /etc/init.d/wallboard /etc/rc2.d/S05wallboard
sudo ln -s /etc/init.d/wallboard /etc/rc4.d/S05wallboard
sudo ln -s /etc/init.d/wallboard /etc/rc5.d/S05wallboard
sudo service wallboard enable
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

## /boot/config.txt

I've had success on several TVs with these settings
```
overscan_left=-46
overscan_right=-46
overscan_top=-46
overscan_bottom=-46
disable_overscan=0
gpu_mem=128
hdmi_drive=2
hdmi_group=1
hdmi_mode=16
```

## /etc/kbd/config

Prevent screen sleep
```
BLANK_TIME=0
POWERDOWN_TIME=0
```

