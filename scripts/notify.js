// Description:
//   segment rocketchat user audience and notifies them through direct message.
// Commands:
//   hubot authorize <user-role>
//   hubot list - lists targets names
//   hubot target create <target_name>
//   hubot user add <@username>
//   hubot user remove <@username>
//   hubot target describe <target_name>
//   hubot target duplicate <target_name> <target_new_name>
//   hubot target delete <target_name>
//   hubot set <target_name>
//   hubot message \n <message>
//   hubot send <message>
//   hubot status <notify_id>
//   hubot resend <all|unread|edit> <notify_id>
//   hubot delete <notify_id>
//   ------------------------------------------
// Configuration:
//   MONGODB_URL
//   USERNAME
//   PASSWORD
// Dependencies:
//   hubot-iwelt-mongodb-brain hubot-conversation

module.exports = function (robot) {
	var MONGODB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/hubot";
	var _ = require('underscore');
	// const Conversation = require('hubot-conversation');
	// const Q = require('q');
	var targets = {};
	var help = {};
	var usersAndRoles = {};
	function describe(command, description) {
		help[command] = description;
	}

	const getUserRoles = async function () {
		users = await robot.adapter.driver.callMethod('getUserRoles');
		if (users) {
			robot.logger.debug("gUR Users: " + JSON.stringify(users));
			users.forEach(function (user) {
				user.roles.forEach(function (role) {
					if (typeof (usersAndRoles[role]) == 'undefined') {
						usersAndRoles[role] = [];
					}
					usersAndRoles[role].push(user.username);
				});
			});
			robot.logger.info("gUR Users and Roles loaded: " + JSON.stringify(usersAndRoles));
		}
		else {
			console.log("gUR NOT loaded!!!");
		}
	};
	getUserRoles();

	const checkRole = async function (role, uname)
	{
		robot.logger.debug("cR uname: " + uname);
		robot.logger.debug("cR role: " + role);
		if (typeof (usersAndRoles[role]) !== 'undefined') {
			if (usersAndRoles[role].indexOf(uname) === -1) {
				robot.logger.debug("cR role: " + role);
				robot.logger.debug("cR indexOf: " + usersAndRoles[role].indexOf(uname));
				return false;
			}
			else {
				return true;
			}
		}
		else {
			robot.logger.info("Role " + role + " não encontrado");
			return false;
		}
	};
	// Remove the robot name to isolate the matched words
	const stripRobotName = function (match) {
		let named;
		const nameStart = match.charAt(0) === '@' ? 1 : 0;
		if (match.indexOf(robot.name) === nameStart) {
			named = robot.name;
		}
		else if (match.indexOf(robot.alias) === nameStart) {
			named = robot.alias;
		}
		else if (match.indexOf('Hubot') === nameStart) {
			named = 'Hubot'; // dialog prepends hubot (this is dumb)
		}
		else if (match.indexOf('hubot') === nameStart) {
			named = 'hubot';
		}
		let nameLength = named === undefined ? 0 : nameStart + named.length;
		if (match.charAt(nameLength) === ':') {
			nameLength++;
		}
		return match.substring(nameLength).trim();
	};

	function limitResult(res, result) {
		if (res.params.limit > 0) {
			return result.slice(0, res.params.limit);
		}
		return result;
	}
	const extractParams = function (res, params) {
		params = params.replace(/\s+/g, '').split(',');
		var defaultParams = {
			'target': function () {
				return robot.brain.get('default_target_by_room_' + res.envelope.room);
			}
		};
		for (var i = 0; i < params.length; i++) {
			var param = params[i];
			res.params[param] = res.match[i + 1];
			if (!res.params[param] && defaultParams[param]) {
				res.params[param] = typeof defaultParams[param] === 'function' ? defaultParams[param]() : defaultParams[param];
			}
		}
	};
	function getSetTargetMessage() {
		var robot_name = robot.alias || robot.name;
		return `Use \`${robot_name} target set <target_name>\` to set default target`;
	}
	// Renders
	function renderTargets(res, msg, records) {
		var found = false;
		keys = _.keys(records);
		_.each(keys, function(item) {
			if (String(item) === String(robot.brain.get('default_target_by_room_' + res.envelope.room))) {
				found = true;
				msg += `- **${item}**`;
			}else{
				msg += `- ${item}`;
			}
			msg += `\n`;
		});
		if (found === false) {
			msg += '\n' + getSetTargetMessage();
		}
		return msg;
	}
	function renderUsers(res, msg, records) {
		var initialLength = msg.length;
		var found = false;
		_.forEach(records, function (item) {
			console.log(item);
			msg += `- ${item}\n`;
		});
		if (msg.length <= initialLength)
			msg += `\n **No users found in this target**`;
		return msg;
	}
	const sendNotification = async function (msg,users){

		_.each(users, async function (username) {
			try{
				// get room id
				rid = await robot.adapter.driver.getDirectMessageRoomId(username.trim().substring(1));
				console.log(">>>>>THIS IS RID" + JSON.stringify(rid));
				console.log(`Username ${username} has roomID ${rid}`);

				receipt = await robot.adapter.driver.sendToRoomId(msg, rid);
				if(receipt){
					console.log(`\n\n>>> SENDING MESSAGE ${username} = ${rid} success`);
				}else{
					console.error(`CAN'T SEND message to ${username} at rid ${rid}`);
				}
				//console.log(robot.adapter);
			}catch (e) {
				return robot.logger.error(`Error sending direct message to ${username}: ${ e }`);
			} finally {
				return true;
			}
		});
	}
	// Set auth framework
	robot.listenerMiddleware(function (context, next, done) {
		context.response.params = context.response.params || {};
		if (!context.listener.options) {
			return next();
		}
		if (context.listener.options.params) {
			extractParams(context.response, context.listener.options.params);
		}
		if (context.listener.options.requireTarget === true) {
			if (!context.response.params.project) {
				context.response.params.target = robot.brain.get('target_by_room_' + context.response.envelope.room);
				return context.response.reply(getSetTargetMessage());
			}
		}
		// set GITLAB_TOKEN and GITLAB_URL
		// if (!context.response.params.gitlab_token) {
		// 	context.response.params.gitlab_token = robot.brain.get('gitlab_token_by_room_' + context.response.envelope.room);
		//   context.response.params.gitlab_url = robot.brain.get('gitlab_url_by_room_' + context.response.envelope.room);
		// 	if (!context.response.params.gitlab_url) {
		// 		robot.brain.set('gitlab_url_by_room_'+context.response.envelope.room, GITLAB_URL);
		// 	}
		// 	if (!context.response.params.gitlab_token && !GITLAB_TOKEN) {
		// 		return context.response.reply(getGitlabToken());
		// 	}else if (!context.response.params.gitlab_token && GITLAB_TOKEN !== false){
		// 		robot.brain.set('gitlab_token_by_room_'+context.response.envelope.room, GITLAB_TOKEN);
		// 	}
		// }
		// gitlab[context.response.envelope.room] = require('gitlab')({
		// 	url: robot.brain.get('gitlab_url_by_room_'+context.response.envelope.room),
		// 	token: robot.brain.get('gitlab_token_by_room_'+context.response.envelope.room)
		// });
		// check security clearance
		robot.logger.debug("MID rc_role=" + context.response.params.rc_role);
		robot.logger.debug("MID user.name=" + context.response.message.user.name);
		if (robot.brain.get('security_role_by_room_' + context.response.envelope.room) !== null) {
			if (checkRole(robot.brain.get('security_role_by_room_' + context.response.envelope.room), context.response.message.user.name) || checkRole('admin', context.response.message.user.name)) {
				robot.logger.debug("ACCESS GRANTED in middlewareListener");
			}
			else {
				robot.logger.debug("ACCESS DENIED in middlewareListener");
				return context.response.reply("`Access Denied!`");
			}
		}
		next();
	});
	///////////////
	// LISTENERS //
	///////////////
	// Security
	robot.respond(/auth(?:orize)? (.+)/i, { params: 'rc_role' }, function (res) {
		robot.logger.debug("CB rc_role=" + res.params.rc_role);
		if (!res.params.rc_role) {
			robot.logger.info("No role given");
			return res.reply(`You need to specify an actual Rocket.Chat role.`);
		}
		else {
			if (checkRole('admin', res.message.user.name)) {
				if (typeof (usersAndRoles[res.params.rc_role]) !== 'undefined') {
					robot.brain.set('security_role_by_room_' + res.envelope.room, res.params.rc_role);
					res.reply(`New access level setted to role \`${robot.brain.get('security_role_by_room_' + res.envelope.room)}\``);
				}
				else {
					res.reply(`The role \`${res.params.rc_role}\` was not found. Please use an actual role.`);
				}
			}
			else {
				res.reply(`Access Denied! You must have admin role to perform this action.`);
			}
		}
	});
	//LIST
	robot.respond(/l(?:ist)?/i, { }, function (res) {
		records = robot.brain.get('targets_by_room_' + res.envelope.room);
		var msg = 'This are the targets you created:\n';
		res.reply(renderTargets(res, msg, records));
	});
	// TARGET CREATE
	robot.respond(/t(?:arget)? create (.+)/i, { params: 'target' }, function (res) {
		// create a target
		if (res.params.target){
			targets = robot.brain.get('targets_by_room_' + res.envelope.room) || {};
			if (res.params.target in targets) {
				return res.reply(`Target ${res.params.target} already exists`);
			}else{
				targets[res.params.target] = [];
				robot.brain.set('targets_by_room_' + res.envelope.room, targets)
				robot.brain.set('default_target_by_room_' + res.envelope.room, res.params.target)
				return res.reply(`Target ${res.params.target} created and set as default!`);
			}
		} else {
			return res.reply(`Please specify a target name!`);
		}	
	});
	// TARGET SET
	robot.respond(/t(?:arget)? set (.+)/i, {params: 'target'}, function (res) {
		if(!res.params.target){
			return res.reply(`Please specify a target name`);
		}else{
			robot.brain.set('default_target_by_room_' + res.envelope.room, res.params.target);
			return res.reply(`Target ${res.params.target} was set as default!`);
		}
	});

	robot.respond(/u(?:ser)? add (.+)/i, { params: 'username', targetRequired: true }, function (res) {
		//TODO: Checks if username exists
		var target_name = robot.brain.get('default_target_by_room_' + res.envelope.room);
		var targets = robot.brain.get('targets_by_room_' + res.envelope.room);
		if(targets[target_name].push(res.params.username)){
			robot.brain.set('targets_by_room_' + res.envelope.room, targets);
			return res.reply(`User ${res.params.username} was added to ${target_name}!`);
		}
	});
	// User list
	robot.respond(/u(?:ser)? list/i, { targetRequired: true }, function (res) {
		defaultTarget = robot.brain.get('default_target_by_room_'+res.envelope.room);
		if(defaultTarget){
			var targets = robot.brain.get('targets_by_room_' + res.envelope.room);
			var records = targets[defaultTarget];
			var msg = `These are the users in ${defaultTarget}:\n`;
			res.reply(renderUsers(res, msg, records));
		} else {
			return res.reply(getSetTargetMessage());
		}
	});

	// User list
	robot.respond(/s(?:end)? (.+)/i, { params: 'message', targetRequired: true }, function (res) {
		defaultTarget = robot.brain.get('default_target_by_room_'+res.envelope.room);
		if(defaultTarget){
			var targets = robot.brain.get('targets_by_room_' + res.envelope.room);
			var records = targets[defaultTarget];
			if(res.params.message){
				sendNotification(res.params.message,records);
				return res.reply(`>your message:\n${res.params.message}\n>is being sended to:\n${records}`);
			}
			
		} else {
			return res.reply(getSetTargetMessage());
		}
	});


	// Milestone
	robot.respond(/m(?:ilestone)? list\s?(all|opened|closed)*/i, { params: 'status', requireProject: true }, function (res) {
		gitlab[res.envelope.room].projects.milestones.all(res.params.project, function (records) {
			var msg = `Milestones from **Project #${res.params.project}**\n`;
			res.reply(renderMilestones(res, msg, records));
		});
	});
	// Builds
	robot.respond(/b(?:uild)? list\s?(created|pending|running|failed|success|canceled|skipped)?/i, { params: 'scope', requireProject: true }, function (res) {
		var params = {};
		if (res.params.scope) {
			params.scope = res.params.scope;
		}
		gitlab[res.envelope.room].projects.builds.listBuilds(res.params.project, params, function (records) {
			var msg = `Builds from **Project #${res.params.project}**\n`;
			res.reply(renderBuilds(res, msg, records));
		});
	});
	robot.respond(/b(?:uild)? play (\d+)/i, { params: 'build', requireProject: true }, function (res) {
		gitlab[res.envelope.room].projects.builds.play(res.params.project, res.params.build, function (record) {
			var msg = `Playing build ${res.params.build} in **Project #${res.params.project}**\n`;
			if (record == true) {
				return res.reply(msg + 'Build already executed or nonexistent');
			}
			res.reply(renderBuilds(res, msg, [record]));
		});
	});
	robot.respond(/b(?:uild)? retry (\d+)/i, { params: 'build', requireProject: true }, function (res) {
		gitlab[res.envelope.room].projects.builds.retry(res.params.project, res.params.build, function (record) {
			var msg = `Retrying build ${res.params.build} in **Project #${res.params.project}**\n`;
			res.reply(renderBuilds(res, msg, [record]));
		});
	});
	robot.respond(/b(?:uild)? erase (\d+)/i, { params: 'build', requireProject: true }, function (res) {
		gitlab[res.envelope.room].projects.builds.erase(res.params.project, res.params.build, function (record) {
			var msg = `Erasing build ${res.params.build} in **Project #${res.params.project}**\n`;
			if (record == true) {
				return res.reply(msg + 'Build already erased or nonexistent');
			}
			res.reply(renderBuilds(res, msg, [record]));
		});
	});
	// Issue
	robot.respond(/i(?:ssue)? list\s?(all|opened|closed)*/i, { params: 'status', requireProject: true }, function (res) {
		gitlab[res.envelope.room].projects.issues.list(res.params.project, function (records) {
			var msg = `Issues from **Project #${res.params.project}**\n`;
			res.reply(renderIssues(res, msg, records));
		});
	});
	robot.respond(/i(?:ssue)? create\s(.+)\s*\n?((?:.*\n?)*)/i, { params: 'title, description', requireProject: true }, function (res) {
		var data = {
			title: res.params.title,
			description: res.params.description
		};
		gitlab[res.envelope.room].issues.create(res.params.project, data, function (record) {
			var msg = `Issue created in **Project #${res.params.project}**\n`;
			res.reply(renderIssues(res, msg, [record]));
		});
	});
	robot.respond(/i(?:ssue)? assign (\d+) (\w+)/i, { params: 'issue, username', requireProject: true }, function (res) {
		gitlab[res.envelope.room].users.all(function (users) {
			var user = _.findWhere(users, { username: res.params.username });
			if (!user) {
				return res.reply(`User with username \`${res.params.username}\` not found`);
			}
			var data = {
				assignee_id: user.id
			};
			gitlab[res.envelope.room].issues.edit(res.params.project, res.params.issue, data, function (record) {
				var msg = `Issue assigned to \`${user.username}\` in **Project #${res.params.project}**\n`;
				res.reply(msg);
			});
		});
	});
	robot.respond(/i(?:ssue)? (close|reopen) (\d+)/i, { params: 'action, issue', requireProject: true }, function (res) {
		var data = {
			state_event: res.params.action
		};
		gitlab[res.envelope.room].issues.edit(res.params.project, res.params.issue, data, function (record) {
			// robot.logger.debug(record);
			if (record !== null) {
				var msg = `Issue ${record.id} is now ${record.state} in **Project #${res.params.project}**\n`;
				res.reply(renderIssues(res, msg, [record]));
			}
			else {
				res.reply(`There was a problem editing issue #${res.params.issue}`);
			}
		});
	});
	robot.respond(/i(?:ssue)? (remove) (\d+)/i, { params: 'action, issue', requireProject: true }, function (res) {
		gitlab[res.envelope.room].issues.remove(res.params.project, res.params.issue, function (record) {
			if (record === true) {
				res.reply(`Issue ${res.params.issue} was removed in **Project #${res.params.project}**`);
			}
			else {
				res.reply(`There was a problem removing issue ${res.params.issue} in **Project #${res.params.project}**`);
			}
		});
	});
	// Pipeline
	robot.respond(/pi(?:peline)? list/i, { requireProject: true }, function (res) {
		gitlab[res.envelope.room].pipelines.all(res.params.project, function (records) {
			var msg = `Pipeline list in **Project #${res.params.project}**\n`;
			res.reply(renderPipelines(res, msg, records));
		});
	});
	// Deployments
	robot.respond(/d(?:eployment)? list/i, { requireProject: true }, function (res) {
		gitlab[res.envelope.room].deployments.all(res.params.project, function (records) {
			var msg = `Pipeline list in **Project #${res.params.project}**\n`;
			res.reply(renderPipelines(res, msg, records));
		});
	});
}
