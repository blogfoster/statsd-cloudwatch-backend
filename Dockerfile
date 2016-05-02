FROM node:5

RUN mkdir -p /src
WORKDIR /src
VOLUME /src

EXPOSE 8080
