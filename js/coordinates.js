/* Shared coordinate helpers (dataForm.html + records.html) */
(function (w) {
  var NUM = '([-+]?\\d{1,3}(?:\\.\\d+)?)';
  var RE = new RegExp('^\\s*' + NUM + '\\s*[°]?\\s*[N]?\\s*(?:,|;|\\s)\\s*' + NUM + '\\s*[°]?\\s*[E]?\\s*$', 'i');

  /* Accepts "13.8651, 120.9278", "13.8651 120.9278", "13.8651,120.9278", "(13.8651, 120.9278)".
     Returns {lat, lng, text, swapped} or {error}. Empty input => {empty:true}. */
  function parseCoordinates(input) {
    var s = String(input == null ? '' : input).replace(/[()\[\]]/g, ' ').trim();
    if (!s) return { empty: true };
    var m = s.match(RE);
    if (!m) return { error: 'Coordinates must look like "13.8651, 120.9278" (latitude, longitude).' };
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]), swapped = false;
    // Philippines is ~lat 4-22, lng 116-128. If they were typed the other way round, fix it.
    if (lat >= 116 && lat <= 128 && lng >= 4 && lng <= 22) { var t = lat; lat = lng; lng = t; swapped = true; }
    if (!(lat >= -90 && lat <= 90)) return { error: 'Latitude must be between -90 and 90.' };
    if (!(lng >= -180 && lng <= 180)) return { error: 'Longitude must be between -180 and 180.' };
    return { lat: lat, lng: lng, swapped: swapped, text: lat.toFixed(6) + ', ' + lng.toFixed(6) };
  }

  function outsidePhilippines(c) {
    return !(c.lat >= 4 && c.lat <= 22 && c.lng >= 116 && c.lng <= 128);
  }

  /* Promise-based GPS: precise first, then falls back to a quicker, coarser fix. */
  function getCurrentCoordinates() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject({ message: 'Geolocation is not supported by this browser.' });
      if (w.isSecureContext === false) return reject({ message: 'Location needs a secure (https) connection.' });
      function ok(pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); }
      function fail(err) {
        var msg = 'Unable to get your location.';
        if (err && err.code === 1) msg = 'Location permission was denied. Allow location access for this site and try again.';
        else if (err && err.code === 2) msg = 'Your device could not determine its position. Turn on GPS/Location and try again.';
        else if (err && err.code === 3) msg = 'Getting your location timed out. Move to an open area and try again.';
        reject({ code: err && err.code, message: msg });
      }
      navigator.geolocation.getCurrentPosition(ok, function (err) {
        if (err && err.code === 1) return fail(err);               // denied: no point retrying
        navigator.geolocation.getCurrentPosition(ok, fail,
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
    });
  }

  w.Coords = { parse: parseCoordinates, outsidePhilippines: outsidePhilippines, getCurrent: getCurrentCoordinates };
})(window);
