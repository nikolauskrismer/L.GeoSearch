/*
 * L.Control.GeoSearch - search for an address and zoom to its location
 * https://github.com/smeijer/leaflet.control.geosearch
 */

L.GeoSearch = {};
L.GeoSearch.Provider = {};
L.GeoSearch.ReverseProvider = {};

L.GeoSearch.ReverseResult = function (lon, lat, address, displayName) {
    this.lon = lon;
    this.lat = lat;
    this.address = address;
    this.displayName = displayName;
};

L.GeoSearch.Result = function (lon, lat, displayName) {
    this.lon = lon;
    this.lat = lat;
    this.displayName = displayName;
};

L.Control.GeoSearch = L.Control.extend({
    options: {
        doReverseLookup: false,
        position: 'topleft',
        provider: null,
        showMarker: true
    },

    _config: {
        country: '',
        searchLabel: 'search for address ...',
        notFoundMessage: 'Sorry, that address could not be found.',
        messageHideDelay: 3000,
        zoomLevel: 18
    },

    // Public methods

    initialize: function (options) {
        L.Util.extend(this.options, options);
        L.Util.extend(this._config, options);
    },

    geosearch: function (qry) {
        try {
            var provider = this._config.provider;

            if(typeof provider.GetLocations == 'function') {
                var results = provider.GetLocations(qry, function(results) {
                    this._processResults(results);
                }.bind(this));
            } else {
                var url = provider.GetServiceUrl(qry);
                this.sendRequest(provider, url);
            }
        } catch (error) {
            this._printError(error);
        }
    },

    onAdd: function (map) {
        var $controlContainer = map._controlContainer,
            nodes = $controlContainer.childNodes;

        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-control-geosearch');
        this._resultSet = [];

        var searchbox = document.createElement('input');
        searchbox.id = 'leaflet-control-geosearch-qry';
        searchbox.type = 'text';
        searchbox.placeholder = this._config.searchLabel;
        this._searchbox = searchbox;

        var searchbtn = document.createElement('button');
        searchbtn.id = 'leaflet-control-geosearch-btn';
        searchbtn.className = 'leaflet-control-geosearch-btn';
        this._searchbtn = searchbtn;

        var msgbox = document.createElement('div');
        msgbox.id = 'leaflet-control-geosearch-msg';
        msgbox.className = 'leaflet-control-geosearch-msg';
        this._msgbox = msgbox;

        var resultslist = document.createElement('ul');
        resultslist.id = 'leaflet-control-geosearch-results';
        this._resultslist = resultslist;

        this._msgbox.appendChild(this._resultslist);
        this._container.appendChild(this._searchbtn);
        this._container.appendChild(this._searchbox);
        this._container.appendChild(this._msgbox);

        L.DomEvent
          .addListener(this._container, 'click', L.DomEvent.stop)
          .addListener(this._searchbtn, 'click', this._onSearchClick, this)
          .addListener(this._searchbox, 'keypress', this._onKeyUp, this);

        if (this._config.doReverseLookup && this._config.provider.options.reverseable) {
            L.DomEvent.addListener(this._map, 'click', this._onMapClick, this);
        }

        L.DomEvent.disableClickPropagation(this._container);

        return this._container;
    },

    sendRequest: function (provider, url) {
        var that = this;

        window.parseLocation = function (response) {
            var results = provider.ParseJSON(response);
            that._processResults(results);

            document.body.removeChild(document.getElementById('getJsonP'));
            delete window.parseLocation;
        };

        function getJsonP (url) {
            url = url + '&callback=parseLocation';
            var script = document.createElement('script');
            script.id = 'getJsonP';
            script.src = url;
            script.async = true;
            document.body.appendChild(script);
        }

        if (XMLHttpRequest) {
            var xhr = new XMLHttpRequest();

            if ('withCredentials' in xhr) {
                var xhr = new XMLHttpRequest();

                xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200) {
                            var response = JSON.parse(xhr.responseText),
                                results = provider.ParseJSON(response);

                            that._processResults(results);
                        } else if (xhr.status == 0 || xhr.status == 400) {
                            getJsonP(url);
                        } else {
                            that._printError(xhr.responseText);
                        }
                    }
                };

                xhr.open('GET', url, true);
                xhr.send();
            } else if (XDomainRequest) {
                var xdr = new XDomainRequest();

                xdr.onerror = function (err) {
                    that._printError(err);
                };

                xdr.onload = function () {
                    var response = JSON.parse(xdr.responseText),
                        results = provider.ParseJSON(response);

                    that._processResults(results);
                };

                xdr.open('GET', url);
                xdr.send();
            } else {
                getJsonP(url);
            }
        }
    },

    // Private methods

    _addressToString : function(address) {
        if (!address) {
            return '';
        }

        var addressStr = '';
        if (address.road) addressStr += address.road + ', ';
        if (address.postcode) addressStr += address.postcode + ', ';
        if (address.country) addressStr += address.country;
        if (/, $/.test(addressStr)) addressStr = addressStr.substring(0, addressStr.length - 2);

        return addressStr;
    },

    _clearResultList : function() {
        this._resultSet = [];
        if (this._timeout != null) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }

        var elem = this._resultslist;
        elem.innerHTML = '';
        elem.style.display = 'none';
    },

    _isInResultSet : function(o) {
        var i = 0,
            set = this._resultSet;

        for (i = 0; i < set.length; ++i) {
            if (set[i].lat == o.lat && set[i].lon == o.lon) {
                return true;
            }
        }

        return false;
    },

    _onKeyUp: function (e) {
        var esc = 27,
            enter = 13,
            queryBox = document.getElementById('leaflet-control-geosearch-qry');

        if (e.keyCode === esc) { // escape key detection is unreliable
            queryBox.value = '';
            this._map._container.focus();
        } else if (e.keyCode === enter) {
            this.geosearch(queryBox.value);
        }
    },

    _onMapClick: function (e) {
        var location = e.latlng,
            provider = this._config.provider;

        if (!location || !provider) {
            return;
        }

        try {
            var url = provider.GetServiceUrl(location.lat, location.lng);
            this.sendRequest(provider, url);
        } catch (error) {
            this._printError(error);
        }
    },

    _onResultClick : function (e) {
        var resultId = e.target.id,
            resultIndex = -1,
            result = null;

        if (resultId) {
            resultIndex = resultId.substring(resultId.lastIndexOf('-') + 1);
        }

        if (resultIndex >= 0) {
            result = this._resultSet[resultIndex];
        }

        if (result) {
            this._showLocation(result);
        }
    },

    _onSearchClick: function (e) {
        var queryBox = document.getElementById('leaflet-control-geosearch-qry');

        this.geosearch(queryBox.value);
    },

    _processResults: function(results) {
        if (results instanceof Array) {
            this._processForwardResults(results);
        } else {
            this._processReverseResults(results);
        }
    },

    _processForwardResults: function(results) {
        var resultCount = results.length;
        if (resultCount <= 0) {
            this._printError(this._config.notFoundMessage);
            return;
        }

        this._map.fireEvent('geosearch_foundlocations', {Locations: results});
        if (resultCount == 1) {
            // only one result found... show it
            this._showLocation(results[0]);
        } else {
            // multiple results found... add to results list and let user choose which one to show
             this._setResultList(results);
        }
    },

    _processReverseResults: function(result) {
        if (!result) {
            this._printError(this._config.notFoundMessage);
        }

        this._map.fireEvent('geosearch_clicklocation', {Location: result});
        this._setResultList([result]);
    },

    _setResultList: function(results) {
        var elem = this._resultslist,
            i = 0,
            j = 0,
            li = null,
            liText = null,
            r = null;

        this._clearResultList();

        for (i = 0, j = 0; i < results.length; ++i) {
            r = results[i];
            if (r.lat == undefined || r.lon == undefined) {
                continue;
            }

            if (this._isInResultSet(r)) {
                continue;
            }

            this._resultSet[this._resultSet.length] = r;
            li = document.createElement('li');
            li.id = 'geosearch-result-' + j;
            li.className = 'geosearch-result';
            liText = document.createTextNode(r.displayName);
            li.appendChild(liText);
            elem.appendChild(li);
            L.DomEvent.addListener(li, 'click', this._onResultClick, this);

            ++j;
        }

        elem.style.display = 'block';
    },

    _showLocation: function (location) {
        if (this.options.showMarker == true) {
            if (typeof this._positionMarker === 'undefined') {
                this._positionMarker = L.marker([location.lat, location.lon]).addTo(this._map);
            } else {
                this._positionMarker.setLatLng([location.lat, location.lon]);
            }
        }

        this._map.setView([location.lat, location.lon], this._config.zoomLevel, false);
        this._map.fireEvent('geosearch_showlocation', {Location: location});
    },

    _printError: function(message) {
        var elem = this._resultslist;
        elem.innerHTML = '<li>' + message + '</li>';
        elem.style.display = 'block';

        var self = this;
        self._timeout = setTimeout(function () {
            elem.style.display = 'none';
            self._timeout = null;
        }, 3000);
    }

});
