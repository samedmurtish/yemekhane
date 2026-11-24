#!/bin/sh
set -eu

for i in $(seq 1 60); do
  if mysqladmin ping -h mysql-primary -uroot -p"$MYSQL_ROOT_PASSWORD" --silent >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

mysql -h mysql-primary -uroot -p"$MYSQL_ROOT_PASSWORD" yemekhane < /migration/04_degisiklik.sql
