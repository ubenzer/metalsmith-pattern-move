"use strict";
var debug = require("debug")("metalsmith-pattern-move");
var _ = require("lodash");
var s = require("string");
var path = require("path");
var minimatch = require("minimatch");

function plugin(options) {
  options = normalize(options);
  options.cwd = s(options.cwd).ensureRight(path.sep).s;

  return function(files, metalsmith, done) {
    var groupMembers = {};
    var groupMasters = {};

    var tbConvertedFiles = _.filter(Object.keys(files), function(file) {
      // check cwd
      if (!s(file).startsWith(options.cwd)) {
        return false;
      }
      var fileInCwd = pathInCwd(options.cwd, file);
      // check src
      return minimatch(fileInCwd, options.src);
    });

    debug("Determining file groups, group id's, masters and url's...");

    // For each file, determine groups and group masters
    var breakMe = false;
    _.forEach(tbConvertedFiles, function(file) {
      var data = files[file];
      debug("Processing file: %s", file);

      // get file name against cwd
      var fileInCwd = pathInCwd(options.cwd, file);
      var fileGroup = options.getGroupId(fileInCwd);

      // add file to a group
      groupMembers[fileGroup] = groupMembers[fileGroup] || [];
      groupMembers[fileGroup].push(fileInCwd);
      data.$groupId = fileGroup;

      // if group has no master, check if file is master
      if (options.isGroupMaster(fileInCwd)) {
        if (_.isPlainObject(groupMasters[fileGroup])) {
          debug("Group named %s already has a master!", fileGroup);
          done(new Error("There are groups without masters!"));
          breakMe = true;
          return false;
        }
        data.$groupMaster = true;
        data.$groupUrl = options.getGroupUrl(fileInCwd, data);
        groupMasters[fileGroup] = data;
      } else {
        data.$groupMaster = false;
      }
    });

    if (breakMe) { return; }

    debug("Checking for groups without masters...");

    // check if there is group with no master and show error
    var groupsWithoutMaster = _.filter(Object.keys(groupMembers), function(aGroup) {
      return !_.isPlainObject(groupMasters[aGroup]);
    });
    if (groupsWithoutMaster.length > 0) {
      debug("There are groups without masters! %s", groupsWithoutMaster);
      done(new Error("There are groups without masters!"));
      return;
    }

    debug("Renaming files...");

    // rename each file using master/slave renaming
    _.forEach(tbConvertedFiles, function(file) {
      var data = files[file];
      debug("Processing file: %s", file);
      var groupMaster = groupMasters[data.$groupId];
      var fileInCwd = pathInCwd(options.cwd, file);

      data.$groupUrl = groupMaster.$groupUrl;

      var fileNameInGroup = options.getFileName(fileInCwd, data);

      var newFileName = path.join(options.dest, data.$groupUrl, fileNameInGroup);
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
    dest: "/",
    getFileName: function(filePathInCwd, fileData) {
      var extension = path.extname(filePathInCwd);
      if (fileData.$groupMaster) {
        return "index" + extension;
      }
      return s(filePathInCwd).between(fileData.$groupId).chompLeft(path.sep).s;
    },
    getGroupId: function(filePathInCwd) { return path.dirname(filePathInCwd); },
    isGroupMaster: function(file) {
      var extension = path.extname(file);
      return extension === ".md";
    },
    getGroupUrl: function(filePathInCwd) {
      return path.dirname(filePathInCwd);
    }
  };
  options = _.merge({}, defaults, options);

  return options;
}

function pathInCwd(cwd, file) {
  return s(file).chompLeft(cwd).s;
}

module.exports = plugin;
