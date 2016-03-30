#!/bin/bash

#hopefully prevent screen blank
sudo sh -c "TERM=linux setterm -powerdown 0 -powersave off -blank 0 >/dev/tty0"
sudo killall -o 3s do.bash 2> /dev/null
sudo killall phantomjs 2> /dev/null
# note fbi is handled in /etc/init/wallboard_fbi.conf

function updatemyip {
    MYIP=`echo -n mac:\`/sbin/ifconfig eth0 | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/ /g' | sed 's/\s\+/ /g' | cut -d' ' -f5,7\``;
}

function restart_fbi {
    sudo killall fbi 2> /dev/null
    sudo /usr/bin/fbi -a -t 1 -cachemem 0 -noverbose -T 1 -d /dev/fb0 /dev/shm/wall/*.gif | logger -t wall_fbi &
}

while [ ! -d /dev/shm/wall ]
do
    sleep 0.5; # wait a tiny amount between retries
    mkdir /dev/shm/wall 2> /dev/null
done

# fbi needs 3 images to not cache, links work great for this
cp /home/wallboard/comingsoon.gif /dev/shm/wall/wall_tmp.gif
ln -s /dev/shm/wall/wall_tmp.gif /dev/shm/wall/wall_tmp2.gif 2> /dev/null
ln -s /dev/shm/wall/wall_tmp.gif /dev/shm/wall/wall_tmp3.gif 2> /dev/null
restart_fbi

# show mac and address on the screen while we wait for the wallboard to load
updatemyip
convert -size 1920x1080 -background black -fill white -font Helvetica -pointsize 50 -draw "text 40,70 `echo -n \\"$MYIP\\"`" /home/wallboard/comingsoon.gif /dev/shm/wall_tmp.gif
mv -f /dev/shm/wall_tmp.gif /dev/shm/wall/wall_tmp.gif

# pages load very slowly if we enable ipv6
sudo sh -c 'echo 1 > /proc/sys/net/ipv6/conf/eth0/disable_ipv6' 

while [ 0 -eq 0 ]; do
    OUTLONG='Unknown'
    OUT=0
    set -o pipefail; # allows me to get the error code from phantomjs rather than logger
    nice -n 19 /home/wallboard/phantomjs-raspberrypi/bin/phantomjs --cookies-file=/dev/shm/wall_cookies.txt --ssl-protocol=tlsv1 --ignore-ssl-errors=true /home/wallboard/webpage_xscreensaver/rasterize.js https://i.bluehost.com/cgi-bin/util/cardservice?step=card_service wall_tmp.gif "1920px*1080px" 1.0 2>&1 | logger -t wall_phantomjs
    OUT=$?
    [ $OUT -eq 1 ] && OUTLONG='Could not load page';
    [ $OUT -eq 2 ] && OUTLONG='Cookie expired';
    [ $OUT -eq 3 ] && OUTLONG='Could not render image from page';
    updatemyip
    restart_fbi
    echo -e "\n $MYIP\n\n wallboard died with error code $OUT ($OUTLONG)\n\n Attempting to recover, if this message stays up for longer than one minute.\n Please turn off the TV for 5 seconds then turn it back on to restart the wallboard." | convert -size 1920x1080 -background black -fill white -font Helvetica -pointsize 50 label:@- /dev/shm/wall_tmp.gif
    mv -f /dev/shm/wall_tmp.gif /dev/shm/wall/wall_tmp.gif
    sleep 10; # give a little bit of time before we attempt recovery
done