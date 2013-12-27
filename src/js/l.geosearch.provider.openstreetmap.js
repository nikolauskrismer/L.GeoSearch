/**
 * L.Control.GeoSearch - search for an address and zoom to it's location
 * L.GeoSearch.Provider.OpenStreetMap uses openstreetmap geocoding service
 * https://github.com/smeijer/leaflet.control.geosearch
 */

L.GeoSearch.Provider.OpenStreetMap = L.Class.extend({
    options : {
        reverseable: true
    },

    initialize : function(options) {
        options = L.Util.setOptions(this, options);
    },

    GetServiceUrl : function(qry, lon) {
        if (!lon) {
            // only one parameter given (query).. perform a forward lookup
            return this._getForwardServiceUrl(qry);
        }

        // second parameter set... perform a reverse lookup
        return this._getReverseServiceUrl(qry, lon);
    },

    ParseJSON : function(data) {
        if (data instanceof Array) {
            return this._parseForwardJSON(data);
        }

        return this._parseReverseJSON(data);
    },

    _getReverseServiceUrl : function(lat, lon) {
        var parameters = L.Util.extend({
            lat: lat,
            lon: lon,
            format : 'json'
        }, this.options);

        return 'http://nominatim.openstreetmap.org/reverse'
                + L.Util.getParamString(parameters);
    },

    _getForwardServiceUrl: function(qry) {
        var parameters = L.Util.extend({
            q : qry,
            format : 'json'
        }, this.options);

        return 'http://nominatim.openstreetmap.org/search'
                + L.Util.getParamString(parameters);
    },

    _parseForwardJSON : function(data) {
        if (data.length == 0)
            return [];

        var results = [];
        for (var i = 0; i < data.length; i++)
            results.push(new L.GeoSearch.Result(
                data[i].lon,
                data[i].lat,
                data[i].display_name
            ));

        return results;
    },

    _parseReverseJSON : function(data) {
        if (data.length == 0)
            return {};

        return new L.GeoSearch.ReverseResult(
            data.lon,
            data.lat,
            data.address,
            data.display_name
        );
    }
});
