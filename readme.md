# IPFS Computes Core

````
npm install

DOMAIN_KEY=0381de45-609c-682e-7258-4e79ed738f00 npm start

````

mkdir /tmp/ipfs-docker-staging
mkdir /tmp/ipfs-docker-data
docker run -d --name computes-ipfsx \
  -v /tmp/ipfs-docker-staging:/export -v /tmp/ipfs-docker-data:/data/ipfs \
  -p 8080:8080 -p 4001:4001 -p 127.0.0.1:5001:5001 \
  computes/ipfs-core:latest
