#!/bin/sh

APPPATH=~/apps/simaya
ln -s ~/apps/simaya/ownbox/models ~/apps/simaya/ob
ln -s ~/apps/simaya/sinergis-base/sinergis ~/apps/simaya/sinergis

# Get index of simaya app in forever process list
if [ $(forever list | grep simaya/app.js | awk '{print $2}' | cut -c2) ]
then
    echo "Simaya is running. Restart"
    forever restart $(forever list | grep simaya/app.js | awk '{print $2}' | cut -c2)
else
    echo "Simaya is not running"
    export PORT=3000
    export DBHOST=10.0.1.5
    export DB=simaya
    forever start ~/apps/simaya/app.js > /dev/null
fi
