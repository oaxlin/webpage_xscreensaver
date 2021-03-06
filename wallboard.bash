#!/bin/bash

if [[ $EUID -ne 0 ]]; then
  echo "You must be a root user" 2>&1
  exit 1
fi

#kill any previous versions
sudo killall -o 3s do.bash 2> /dev/null
sudo pkill -f 'node puppeteer_rasterize.js' 2> /dev/null

function updatemyip {
    MYDEV=`echo -n \`/sbin/ifconfig | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/ /g' | sed 's/\s\+/ /g' | cut -d' ' -f1\``;
    MYIP=`echo -n mac:\`/sbin/ifconfig | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/ /g' | sed 's/\s\+/ /g' | cut -d' ' -f5,7\``;
}

function make_img {
    echo -e "text 115,215 \"$1\"" > /dev/shm/ip.txt
    convert -size 1920x1080 xc:black -font "Helvetica" -pointsize 60 -fill white -draw @/dev/shm/ip.txt /dev/shm/wall_ip.jpg
    cp /dev/shm/wall_ip.jpg /dev/shm/wall_tmp.jpg
    mv -f /dev/shm/wall_tmp.jpg /dev/shm/wall/wall_tmp.jpg
}

function restart_fbi {
    sudo killall fbi 2> /dev/null
    sudo /usr/bin/fbi -a -t 1 -cachemem 0 -noverbose -T 1 -d /dev/fb0 /dev/shm/wall/*.jpg | logger -t wall_fbi &
}

while [ ! -d /dev/shm/wall ]
do
    sleep 0.5; # wait a tiny amount between retries
    mkdir /dev/shm/wall 2> /dev/null
done

# fbi needs 3 images to not cache, links work great for this
cp /home/pi/webpage_xscreensaver/comingsoon.gif /dev/shm/wall/wall_tmp.jpg
ln -s /dev/shm/wall/wall_tmp.jpg /dev/shm/wall/wall_tmp2.jpg 2> /dev/null
ln -s /dev/shm/wall/wall_tmp.jpg /dev/shm/wall/wall_tmp3.jpg 2> /dev/null
rm -f /dev/shm/wall/wall_tmp*.gif # remove old gif files if they exist
restart_fbi

# show mac and address on the screen while we wait for the wallboard to load
re='[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+';
maxTries=20;
updatemyip
while [[ $maxTries -gt 0 && !($MYIP =~ $re) ]]; do
    if [ $maxTries -eq 20 ]; then
       echo "No valid IP found: $MYIP";
       make_img "$MYIP"
    fi
    let maxTries=maxTries-1;
    updatemyip
    sleep 0.5;
done
echo $MYIP;
make_img "$MYIP"

# some pages load very slowly if ipv6 is enabled
# for some reason the sysctl doesn't work
# /etc/sysctl.conf
# net.ipv6.conf.all.disable_ipv6 = 1
sudo sh -c "echo 1 > /proc/sys/net/ipv6/conf/$MYDEV/disable_ipv6" 

#hopefully prevent screen blank
sudo sh -c "TERM=linux setterm -powerdown 0 -powersave off -blank 0 >/dev/tty0"

cd /home/pi/webpage_xscreensaver/
while [ 0 -eq 0 ]; do
    LASTpull=`stat -c %y .git/FETCH_HEAD | awk '{print $1}'`
    DAYSpull=`date -d $LASTpull +"%j"`
    DAYSnow=`date +"%j"`
    DAYSdiff=`expr $DAYSnow - $DAYSpull`
    if [[ $DAYSdiff -ge 7 ]]; then
        #update once a week
        sudo apt update;sudo apt-get -y dist-upgrade;sudo apt -y autoremove
        echo -n 'Checking for update: '
        git pull
    fi

    restart_fbi
    OUTLONG='Unknown'
    OUT=0
    set -o pipefail; # allows me to get the error code from my script rather than logger
    #nice -n 19 QT_QPA_PLATFORM=offscreen phantomjs --cookies-file=/dev/shm/wall_cookies.txt --ignore-ssl-errors=true /home/pi/webpage_xscreensaver/rasterize.js https://i.bluehost.com/cgi-bin/util/cardservice?step=card_service wall_tmp.jpg "1920px*1080px" 1.0 2>&1
    nice -n 19 node puppeteer_rasterize.js 2>&1
    OUT=$?
    [ $OUT -eq 1 ] && OUTLONG='Could not load page';
    [ $OUT -eq 2 ] && OUTLONG='Cookie expired';
    [ $OUT -eq 3 ] && OUTLONG='Could not render image from page';
    [ $OUT -eq 4 ] && OUTLONG='Password is required';
    [ $OUT -eq 5 ] && OUTLONG='Invalid form information in wall.ini';
    [ $OUT -eq 6 ] && OUTLONG='Uncaught javascript error on page';
    updatemyip
    restart_fbi
    echo -e "\n $MYIP\n\n wallboard died with error code $OUT ($OUTLONG)\n\n Attempting to recover, if this message stays up for longer than one minute.\n Please turn off the TV for 5 seconds then turn it back on to restart the wallboard." | convert -size 1920x1080 -background black -fill white -font Helvetica -pointsize 50 label:@- /dev/shm/wall_tmp.jpg
    mv -f /dev/shm/wall_tmp.jpg /dev/shm/wall/wall_tmp.jpg
    sleep 10; # give a little bit of time before we attempt recovery
done
