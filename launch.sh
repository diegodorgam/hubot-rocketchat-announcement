#!/bin/bash
export HUBOT_ADAPTER=rocketchat
export HUBOT_OWNER=RocketChat
export HUBOT_NAME='notify'
export HUBOT_DESCRIPTION="Public announcements"
export ROCKETCHAT_URL=http://localhost:3000
export ROCKETCHAT_ROOM=GENERAL
export RESPOND_TO_DM=true
export RESPOND_TO_LIVECHAT=true
export ROCKETCHAT_USER=notify
export ROCKETCHAT_PASSWORD='notifypass'
export ROCKETCHAT_AUTH=password
export HUBOT_LOG_LEVEL=debug
export MONGODB_URL='mongodb://localhost:27017/hubot'

bin/hubot -a rocketchat
