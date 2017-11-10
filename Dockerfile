FROM node:alpine

LABEL mantainer "Diego Dorgam <diego.dorgam@rocket.chat>"

ENV RESPOND_TO_LIVECHAT=true LISTEN_ON_ALL_PUBLIC=true RESPOND_TO_DM=true RESPOND_TO_EDITED=true HUBOT_ADAPTER=rocketchat HUBOT_OWNER=RocketChat HUBOT_NAME=Announcements HUBOT_DESCRIPTION="Sends announcements to all users" ROCKETCHAT_URL=http://rocketchat:3000 ROCKETCHAT_ROOM=GENERAL RESPOND_TO_DM=true ROCKETCHAT_USER=chatbot ROCKETCHAT_PASSWORD=@12345@ ROCKETCHAT_AUTH=password HUBOT_LOG_LEVEL=debug

RUN npm install -g coffee-script hubot yo generator-hubot && \
    apk --update add --no-cache git && \
    addgroup -S hubot && adduser -S -g hubot hubot

WORKDIR /home/hubot/bot

RUN mkdir -p /home/hubot/.config/configstore && \
  echo "optOut: true" > /home/hubot/.config/configstore/insight-yo.yml && \
  chown -R hubot:hubot /home/hubot

USER hubot

RUN /usr/local/bin/yo hubot --adapter ${HUBOT_ADAPTER} --owner ${HUBOT_OWNER} --name ${HUBOT_NAME} --description ${HUBOT_DESCRIPTION} --defaults --no-insight

COPY ["external-scripts.json","package.json", "/home/hubot/bot/"]

ADD scripts/ /home/hubot/bot/scripts/

ENTRYPOINT /home/hubot/bot/bin/hubot -a rocketchat
