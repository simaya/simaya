rm -f ob sinergis
ln -s ownbox/models ob
ln -s sinergis-base/sinergis sinergis
DB=${DB:-simaya}
HOST=${HOST:-localhost}
echo "Setting up initial data with DB $DB on HOST $HOST"
node tools/init-admin.js
mkdir uploads
mongoimport -h $HOST -d $DB -c role --drop < tools/initial-data/role
mongoimport -h $HOST -d $DB -c userCategory --drop < tools/initial-data/userCategory
cd ../..
if [ -d node_modules/simaya ];then
    rm -f simaya
    ln -s node_modules/simaya simaya
fi
