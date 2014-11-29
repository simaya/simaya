rm -f ob sinergis
ln -s ownbox/models ob
ln -s sinergis-base/sinergis sinergis
DB=${DB:-simaya}
echo "Setting up initial data with DB $DB"
node tools/init-admin.js
mkdir uploads
mongoimport -d $DB -c role --drop < tools/initial-data/role
cd ../..
ln -s node_modules/simaya simaya
