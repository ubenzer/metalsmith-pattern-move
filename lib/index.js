"use strict";
var debug = require("debug")("metalsmith-pattern-move");
var _ = require("underscore");
var s = require("string");
var path = require("path");
var check = require("check-types");
var minimatch = require("minimatch");
var permalinks = require("permalinks");

function plugin(options) {
	options = normalize(options);
	options.cwd = s(options.cwd).ensureRight(path.sep).s;

  return function(files, metalsmith, done) {
		var groupMembers = {};
		var groupMasters = {};

		var tbConvertedFiles = _.filter(Object.keys(files), function(file) {
			// check cwd
			if (options.cwd.length > 0 && !s(file).startsWith(options.cwd)) {
				return false;
			}
			var fileInCwd = pathInCwd(options.cwd, file);
			// check src
			return minimatch(fileInCwd, options.src);
		});

		// For each file, determine groups and group masters
		_.forEach(tbConvertedFiles, function(file) {
			var data = files[file];
			debug("checking file: %s", file);

			// get file name against cwd
			var fileInCwd = pathInCwd(options.cwd, file);

			var fileGroup = options.getGroupId(fileInCwd);

			// add file to a group
			groupMembers[fileGroup] = groupMembers[fileGroup] || [];
			groupMembers[fileGroup].push(fileInCwd);
			data.$groupId = fileGroup;

			// if group has no master, check if file is master
			if (!check.string(groupMasters[fileGroup])) {
				if (options.isGroupMaster(fileInCwd)) {
					data.$groupMaster = true;
					groupMasters[fileGroup] = data;
				}
			}
    });

		// check if there is group with no master and show error
		var groupsWithoutMaster = _.filter(Object.keys(groupMembers), function(aGroup) {
			return !check.object(groupMasters[aGroup]);
		});
		if (groupsWithoutMaster.length > 0) {
			debug("There are groups without masters! %s", groupsWithoutMaster);
			throw new Error("There are groups without masters!");
		}

		// rename each file using master/slave renaming
		_.forEach(tbConvertedFiles, function(file) {
			var fileInCwd = pathInCwd(options.cwd, file);
			var data = files[file];

			// TODO make this better
			var a = {
				date: groupMasters[data.$groupId].date[0],
				slug: groupMasters[data.$groupId].slug
			};

			var groupUrl = permalinks(options.dest, a);
			data.$groupUrl = s(options.cwd).ensureLeft("/").ensureRight("/").s + s(groupUrl).chompLeft("/").s;
			var fileInGroupUrl = options.inGroupPath(fileInCwd, data.$groupId, groupMasters[data.$groupId] === data);

			var newFileName = s(options.cwd).ensureRight("/").s +
				s(groupUrl).chompLeft("/").chompRight("/").s +
				s(fileInGroupUrl).ensureLeft("/").s;
			files[newFileName] = data;

			delete files[file];
		});

    done();
  };
}

function normalize(options) {
  var defaults = {
    cwd: "",
    src: "**/*",
    dest: ":year/:slug",
    /* eslint-disable no-unused-vars */
    inGroupPath: function(file, groupId, isMaster) { return file; },
    getGroupId: function(file) { return file; },
    isGroupMaster: function(file) { return true; }
    /* eslint-enable */
  };
  options = _.extend(defaults, options);

  return options;
}

function pathInCwd(cwd, file) {
  return s(file).chompLeft(cwd).s;
}

module.exports = plugin;
