#!/bin/sh

export PUSHMODE=prod # isinya prod atau dev
export CERTPASSPHRASE=sandicert # isinya sandi cert apple push notification
export PATH=$PATH:/home/simaya/bin/node-v0.10.17-linux-x64/bin # lokasi path
export DB=simayamaster # basis data yang digunakan
export SSL_CERT_DIR=/etc/ssl/certs
export PORT=3000 # port
export PATH=$PATH:/home/simaya/bin

if [ -f /tmp/node-master-quit ];then
  echo "Ada berkas /tmp/node-master-quit"
  echo "Hapus dulu kalau ingin menjalankan program ini"
  exit
fi

while($1);do
  if [ -f /tmp/node-master-quit ];then
    exit
  fi
  LOG=`date +'%Y%m%d%H%M%S'`.log  
  echo $LOG > app.log
  nohup node app > nohup-$LOG
done

