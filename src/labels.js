/* exported Labels */
// labels.js
// Create, retrieve, and apply Gmail labels safely.

var Labels = (function () {
  var _cache = Object.create(null);

  // Use a prefix to avoid prototype key collisions (__proto__, constructor)
  var _KEY_PREFIX = 'label:';

  function _getOrCreate(name) {
    var key = _KEY_PREFIX + name;
    if (_cache[key]) return _cache[key];
    var existing = GmailApp.getUserLabelByName(name);
    if (existing) {
      _cache[key] = existing;
      return existing;
    }
    var created = GmailApp.createLabel(name);
    _cache[key] = created;
    Logger.log('Created label: ' + name);
    return created;
  }

  function _hasLabel(thread, label) {
    var threadLabels = thread.getLabels();
    var targetName = label.getName();
    for (var i = 0; i < threadLabels.length; i++) {
      if (threadLabels[i].getName() === targetName) return true;
    }
    return false;
  }

  return {
    setup: function () {
      _getOrCreate(Config.getCandidateLabel());
      _getOrCreate(Config.getForwardedLabel());
      _getOrCreate(Config.getRejectedLabel());
      _getOrCreate(Config.getDiscoveredLabel());
      Logger.log('All labels ready.');
    },

    getCandidate:  function () { return _getOrCreate(Config.getCandidateLabel()); },
    getForwarded:  function () { return _getOrCreate(Config.getForwardedLabel()); },
    getRejected:   function () { return _getOrCreate(Config.getRejectedLabel()); },
    getDiscovered: function () { return _getOrCreate(Config.getDiscoveredLabel()); },

    applyForwarded: function (thread) {
      thread.addLabel(Labels.getForwarded());
      thread.removeLabel(Labels.getCandidate());
    },

    applyRejected: function (thread) {
      thread.addLabel(Labels.getRejected());
      thread.removeLabel(Labels.getCandidate());
    },

    applyDiscovered: function (thread) {
      thread.addLabel(Labels.getDiscovered());
    },

    isForwarded: function (thread) {
      return _hasLabel(thread, Labels.getForwarded());
    },

    __reset: function () { _cache = Object.create(null); },
  };
})();
