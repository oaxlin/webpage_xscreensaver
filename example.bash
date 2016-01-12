#!/bin/sh

OUT=0
while [ $OUT -eq 0 ]; do
    phantomjs --cookies-file=~/wall_cookies.txt --ssl-protocol=tlsv1 --ignore-ssl-errors=true rasterize.js https://example.com/page.html wall_tmp.png "1920px*1080px"
    OUT=$?
done
