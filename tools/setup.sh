rm -f ob sinergis
ln -s ownbox/models ob
ln -s sinergis-base/sinergis sinergis
DB=${DB:-simaya}
echo "Setting up initial data with DB $DB"
node tools/init-admin.js
mkdir uploads
mongoimport -d $DB -c role --drop < tools/initial-data/role
mongoimport -d $DB -c userCategory --drop < tools/initial-data/userCategory
cd ../..
if [ -d node_modules/simaya ];then
    rm -f simaya
    ln -s node_modules/simaya simaya
fi
