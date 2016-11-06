
var app = angular.module('EuroApp', ['ngRoute', 'ngSanitize', 'angular-electron']);


/*
	ROUTES
*/

app.config(function($routeProvider) {
	$routeProvider
        .when('/', { 
            templateUrl : './views/countries.html', controller : 'CountriesCtrl'
        })
        .when('/years', { 
            templateUrl : './views/years.html', controller : 'YearsCtrl'
        })
        .otherwise('/');
 });





/*
	COUNTRIES CONTROLLER
*/

app.controller('CountriesCtrl', ['$scope', 'DBService', 'WindowService', function ($scope, DBService, WindowService) {

	var db_countries = new PouchDB('countries');
	var db_years = new PouchDB('years');

	
	$scope.countries = [];

	$scope.current_country = null;
	$scope.current_coin = null;

	$scope.countries_count = [];
	$scope.edited = false;



	db_countries.get("00").then(function (doc) {	 // if the database exists get the data, if it doesn't create the databases
	    console.log("db already exists");
	    db_countries.allDocs({
		    include_docs: true,
		    attachments: true
		}).then(function (result) {

		    for (var i = 0; i < result.rows.length; i++) {
		    	$scope.countries.push(result.rows[i].doc);
		    }
		    countCoins();
		    $scope.$apply();
		    
		}).catch(function (err) {
		    console.log(err);
		});
	}).catch(function (err) {
	    console.log("creating db");
	    DBService.addData(db_countries, db_years);
	});



	$scope.setCurrentCountry = function(id) {

		if ($scope.edited)
			saveCountry(getCurrentCountryId(), true, false);

		$scope.current_country = $scope.countries[id];

	}

	$scope.setCurrentCoin_country = function(country, series, coin_id) {

		if (series == -1)
			$scope.current_coin = country.coins[coin_id];
		else 
			$scope.current_coin = country.other_series[series].coins[coin_id];
		
	}

	$scope.toggleCoinOwned = function(coin) {

		coin.owned = !coin.owned;
		updateCountLabel(getCurrentCountryId(), coin.owned ? 1 : -1);
		$scope.edited = true;

	}


	countCoins = function() {

		for (var i = 0; i < $scope.countries.length; i++) {
			countCoinsCountry(i);
		}

	}

	countCoinsCountry = function(country_id) {

		var max = 0;
		var count = 0;
		var country_coins = $scope.countries[country_id].coins;

		for (var i = 0; i < country_coins.length; i++) {
			max++;
			if (country_coins[i].owned)
				count++;
		}

		if ($scope.countries[country_id].other_series.length > 0) {
			for (var j = 0; j < $scope.countries[country_id].other_series.length; j++) {
				var country_series = $scope.countries[country_id].other_series[j];
				for (var k = 0; k < country_series.coins.length; k++) {
					max++;
					if (country_series.coins[k].owned)
						count++;
				}
			}
		}

		$scope.countries_count.push({
			max: max,
			count: count
		});

	}

	$scope.goToYearsPage = function() {

		if ($scope.current_country && $scope.edited)
			saveCountry(getCurrentCountryId(), false, false);
		else
			WindowService.changePage('#/years');

	}


	saveCountry = function(id, stay, quit) {

		var coins = [];				// current series country coins
		var coins_other = [];		// previous series country coins if they exist

		for (var i = 0; i < 8; i++) {
			var value = false;
			if ($scope.countries[id].coins[i].owned)
				value = true;
			coins.push(value);
		}
		for (var j = 0; j < $scope.countries[id].other_series.length; j++) {
			var series_coins = $scope.countries[id].other_series[j].coins;
			coins_other.push({
				coins: []
			});
			for (var k = 0; k < 8; k++) {
				var value = false;
				if (series_coins[k].owned)
					value = true;
				coins_other[j].coins.push(value);
			}
			
		}

		$scope.edited = false;

		var country_id = (id < 10) ? "0" + id : "" + id;
		db_countries.get(country_id).then(function(doc) {

			var coins_updated = doc.coins.slice(0);					// array that will be saved to the db
			for (var j = 0; j < coins_updated.length; j++) {
				coins_updated[j].owned = coins[j];
			}

			var coins_other_updated = doc.other_series.slice(0);	// array that will be saved to the db
			if ($scope.countries[id].other_series.length > 0) {
				for (var l = 0; l < coins_other_updated.length; l++) {
					var series = coins_other_updated[l].coins;
					for (var m = 0; m < 8; m++)
						series[m].owned = coins_other[l].coins[m];
				}
			}

		    return db_countries.put({
		        _id: country_id,
		        _rev: doc._rev,
		        name: doc.name,
				image: doc.image,
				description: doc.description,
				info: doc.info,
				coins: coins_updated,
				other_series: coins_other_updated
		    });

		}).then(function(response) {
		    console.log("Updated country");

		    if (!stay) {
		    	if (quit)
		    		WindowService.quitApp();
		    	else
		    		WindowService.changePage('#/years');
		    }

		}).catch(function (err) {
		    console.log(err);
		});

	}

	updateCountLabel = function(id, val) {

		$scope.countries_count[id].count += val;

	}


	getCurrentCountryId = function() {

		var current_id = 0;
		var id_string = $scope.current_country._id;
		if (id_string.charAt(0) == "0")
			current_id = parseInt(id_string.charAt(1));
		else
			current_id = parseInt(id_string);
		
		return current_id;
	}

	$scope.minimizeApp = function() {
		WindowService.minimizeApp();
	}

	$scope.maximizeApp = function() {
		WindowService.maximizeApp();
	}

	$scope.quitApp = function() {
		if ($scope.current_country && $scope.edited)
			saveCountry(getCurrentCountryId(), false, true);		// save and exit
		else
			WindowService.quitApp();								// exit
	}


}])





/*
	YEARS CONTROLLER
*/

app.controller('YearsCtrl', ['$scope', 'WindowService', function ($scope, WindowService) {

	var db_years = new PouchDB('years');


	$scope.years = [];

	$scope.current_year = null;
	$scope.current_coin = null;

	$scope.years_count = [];
	$scope.edited = false;
	$scope.edited_year_coins = [];



	db_years.allDocs({		 // get data from the database
	    include_docs: true,
	    attachments: true
	}).then(function (result) {

	    for (var i = 0; i < result.rows.length; i++) {
	    	$scope.years.push(result.rows[i].doc);
	    }
	    countCoins();
		$scope.$apply();

	}).catch(function (err) {
	    console.log(err);
	});



	$scope.setCurrentYear = function(id) {

		if ($scope.edited)
			saveYear(getCurrentYearId(), true, false);

		$scope.current_year = $scope.years[id];

	}

	$scope.setCurrentCoin_year = function(year, coin_id) {

		$scope.current_coin = year.coins[coin_id];

	}


	$scope.toggleCoinOwned = function(coin) {

		coin.owned = !coin.owned;
		updateCountLabel(getCurrentYearId(), coin.owned ? 1 : -1);
		$scope.edited = true;

	}

	$scope.toggleYearCoinOwned = function(coin_id) {

		var current_id = getCurrentYearId();

		var edited_coin = {
			year: current_id,
			coin: coin_id
		}

		$scope.edited_year_coins.push(edited_coin);

	}


	countCoins = function() {

		for (var i = 0; i < $scope.years.length; i++) {
			countCoinsYear(i);
		}

	}

	countCoinsYear = function(year_id) {

		var max = 0;
		var count = 0;
		var year_coins = $scope.years[year_id].coins;

		for (var i = 0; i < year_coins.length; i++) {
			max++;
			if (year_coins[i].owned)
				count++;
		}

		$scope.years_count.push({
			max: max,
			count: count
		});

	}


	$scope.goToCountriesPage = function() {

		if ($scope.current_year && $scope.edited)
			saveYear(getCurrentYearId(), false, false);
		else
			WindowService.changePage('#/countries');

	}


	saveYear = function(id, stay, quit) {

		var coins = [];		// coins of the year that needs to be saved

		for (var i = 0; i < $scope.years[id].coins.length; i++) {
			var value = false;
			if ($scope.years[id].coins[i].owned)
				value = true;
			coins.push(value);
		}

		$scope.edited = false;

		var year_id = (id < 10) ? "0" + id : "" + id;
		db_years.get(year_id).then(function(doc) {

			var coins_updated = doc.coins.slice(0);				// array that will be saved to db
			for (var j = 0; j < coins_updated.length; j++) {
				coins_updated[j].owned = coins[j];
			}

		    return db_years.put({
		        _id: year_id,
		        _rev: doc._rev,
		        year: doc.year,
				coins: coins_updated
		    });

		}).then(function(response) {
		    console.log("Updated year");

		    if (!stay) {
		    	if (quit)
		    		WindowService.quitApp();
		    	else
		    		WindowService.changePage('#/countries');
		    }

		}).catch(function (err) {
		    console.log(err);
		});

	}

	updateCountLabel = function(id, val) {

		$scope.years_count[id].count += val;

	}

	getCurrentYearId = function() {

		var current_id = 0;
		var id_string = $scope.current_year._id;
		if (id_string.charAt(0) == "0")
			current_id = parseInt(id_string.charAt(1));
		else
			current_id = parseInt(id_string);
		
		return current_id;
	}


	$scope.minimizeApp = function() {
		WindowService.minimizeApp();
	}

	$scope.maximizeApp = function() {
		WindowService.maximizeApp();
	}

	$scope.quitApp = function() {
		if ($scope.current_year && $scope.edited)
			saveYear(getCurrentYearId(), false, true);	    // save and exit
		else
			WindowService.quitApp();						// exit
	}

}])





/*
	WINDOW SERVICE
*/

app.service('WindowService', ['$window', 'app', 'BrowserWindow', function($window, app, BrowserWindow) {

	this.changePage = function(page) {

		$window.location.href = page;

	}

	this.minimizeApp = function() {

		BrowserWindow.getFocusedWindow().minimize();

	}

	this.maximizeApp = function() {

		var w = BrowserWindow.getFocusedWindow();
		if (w.isMaximized())
			w.unmaximize();
		else
			w.maximize();

	}

	this.quitApp = function() {

		app.quit();
		
	}

}])





/*
	DB SERVICE
*/

app.service('DBService', function($http, $window) {

	this.addData = function(db_countries, db_years) {		// create the databases

		var file = {};
		var countries_length = 0;
		var years_length = 0;
		
    	$http.get('./db.json')
		.then(function(response) {

			file = response.data;
			console.log(file);
			countries_length = file.countries.length;
			years_length = file.years.length;

			var countries_array = [];
			for (var i = 0; i < countries_length; i++) {
				var country = file.countries[i];
				countries_array.push({
					_id: (i < 10) ? "0" + i : "" + i,
					name: country.name,
					image: country.image,
					description: country.description,
					info: country.info,
					coins: country.coins,
					other_series: country.other_series
				});
			}
			var years_array = [];
			for (var j = 0; j < years_length; j++) {
				var year = file.years[j];
				years_array.push({
					_id: (j < 10) ? "0" + j : "" + j,
					year: year.year,
					coins: year.coins
				});
			}

			db_countries.bulkDocs(countries_array)
			.then(function(response) {
				
				db_years.bulkDocs(years_array)
				.then(function(response) {
					$window.location.reload();
				}).catch(function(err) {
					console.log(err);
				})

			}).catch(function(err) {
				console.log(err);
			})

		}, function(err) {
			console.log(err);
		})

	}

});




