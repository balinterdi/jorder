////////////////////////////////////////////////////////////////////////////////
// jOrder performance tests
////////////////////////////////////////////////////////////////////////////////
/*global jQuery, jOrder, jOB, DB, jLinq, TAFFY */

// registering benchmarks on document ready
(function ($, jOrder, jOB) {
	var
	
	// jOrder
	jorder77 = jOrder.testing.table77,
	jorder1000 = jOrder.testing.table1000,
	
	// db.js
	db77 = DB(jOrder.testing.json77),
	db1000 = DB(jOrder.testing.json1000),
	
	// TAFFY
	// Taffy modofies the original json
	taffy77j,
	taffy77 = new TAFFY(jOrder.testing.json77),
	taffy1000j,
	taffy1000 = new TAFFY(jOrder.testing.json1000);

	// object initialization	
	jOB.benchmark("Object initialization", "jOrder 1.2", "native", "db.js", "jLinq 3.0.1", "Taffy DB 1.7.3");
	
	// Initializing small table
	jOB.test("Small table w/ 6 indexes (5 ordered)", function () {
		var table = jOrder(jOrder.testing.json77)
			.index('id', ['ID'], { ordered: true, type: jOrder.number })
			.index('id_nosort', ['ID'])
			.index('group', ['GroupID'], { ordered: true, grouped: true, type: jOrder.number })
			.index('total', ['Total'], { ordered: true, grouped: true, type: jOrder.number })
			.index('date', ['StartDate'], { ordered: true, grouped: true })
			.index('signature', ['Total', 'Currency'], { ordered: true, grouped: true });
		return jOrder.testing.json77;
	}, 
	// native version needs no initialization
	null,
	function () {
		var table = DB(jOrder.testing.json77);
		return jOrder.testing.json77;
	},
	// jLinq needs no initialization
	null,
	function () {
		var table = new TAFFY(jOrder.testing.json77);
		return jOrder.testing.json77;
	}, {lengthonly: true});

	// Initializing large table
	jOB.test("Large table w/ 3 ordered indexes", function () {
		var table = jOrder(jOrder.testing.json1000)
			.index('id', ['id'], { ordered: true, type: jOrder.number })
			.index('name', ['name'], { ordered: true, grouped: true })
			.index('fulltext', ['name'], { ordered: true, grouped: true, type: jOrder.text });
		return jOrder.testing.json1000;
	}, 
	// native version needs no initialization
	null,
	function () {
		var table = DB(jOrder.testing.json1000);
		return jOrder.testing.json1000;
	},
	// jLinq needs no initialization
	null,
	function () {
		var table = new TAFFY(jOrder.testing.json1000);
		return jOrder.testing.json1000;
	}, {lengthonly: true});

	// Exact search on 77 rows
	jOB.benchmark("Search on small table", "jOrder 1.2", "native", "db.js", "jLinq 3.0.1", "Taffy DB 1.7.3");
	jOB.test("'GroupID' being either 107 or 185", function () {
		return jorder77.where([{ 'GroupID': 107 }, { 'GroupID': 185 }], { renumber: true });
	}, function () {
		var result = [], i, row;
		for (i = 0; i < jOrder.testing.json77.length; i++) {
			row = jOrder.testing.json77[i];
			if (row.GroupID === 107 || row.GroupID === 185) {
				result.push(row);
			}
		}
		return result;
	}, function () {
		return db77
			.find({'GroupID': db77.isin(['107', '185'])})
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json77)
			.equals('GroupID', 107).or(185)
			.select();
	}, function () {
		return taffy77
			.get({'GroupID': ['107', '185']});
	});

	// Exact search on composite index
	jOB.test("where 'Total' = 8 and 'Currency' = 'USD'", function () {
		return jorder77.where([{ 'Currency': 'USD', 'Total': 8 }], { renumber: true });
	}, function () {
		var result = [], i, row;
		for (i = 0; i < jOrder.testing.json77.length; i++) {
			row = jOrder.testing.json77[i];
			if (row.Currency === 'USD' && row.Total === 8) {
				result.push(row);
			}
		}
		return result;		
	}, function () {
		return db77
			.find({'Currency': 'USD', 'Total': 8})
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json77)
			.equals('Total', 8)
			.and('Currency', 'USD')
			.select();
	}, function () {
		return taffy77
			.get({'Total': 8, 'Currency': 'USD'});
	});

	// Range search on 77 rows
	jOB.test("'Total' between 11 and 15", function () {
		return jorder77.where([{ 'Total': { lower: 10.9, upper: 15.1 } }], { mode: jOrder.range, renumber: true });
	}, function () {
		var result = [], i, row;
		for (i = 0; i < jOrder.testing.json77.length; i++) {
			row = jOrder.testing.json77[i];
			if (row.Total >= 11 && row.Total <= 15) {
				result.push(row);
			}
		}
		return result;
	}, function () {
		return db77
			.find(db77('Total', '>= 11'), db77('Total', '<= 15'))
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json77)
			.betweenEquals('Total', 11, 15)
			.select();
	}, function () {
		var pass1 = taffy77.get({'Total': {gte: 11}});
		return new TAFFY(pass1).get({'Total': {lte: 15}});
	});

	// Sorting on 77 rows
	jOB.benchmark("Sorting on small table", "jOrder 1.2", "native", "db.js", "jLinq 3.0.1", "Taffy DB 1.7.3");
	jOB.test("by 'ID'", function () {
		return jorder77.orderby(['ID'], jOrder.asc, { indexName: 'id' });
	}, function () {
		return jOrder.shallow(jOrder.testing.json77).sort(function (a, b) {
			return a.ID > b.ID ? 1 : a.ID < b.ID ? -1 : 0;
		});
	}, function () {
		return db77
			.order('ID', 'asc')
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json77)
			.sort('ID')
			.select();
	}, function () {
		taffy77j = jOrder.shallow(jOrder.testing.json77);
		(new TAFFY(taffy77j))
			.orderBy({'ID': 'asc'});
		return taffy77j;
	});	

	// Exact search on 1000 rows
	jOB.benchmark("Search on big table", "jOrder 1.2", "native", "db.js", "jLinq 3.0.1", "Taffy DB 1.7.3");
	jOB.test("'id' being either 107 or 115", function () {
		return jorder1000.where([{ 'id': 107 }, { 'id': 115 }], {renumber: true});
	}, function () {
		var result = [], i, row;
		for (i = 0; i < jOrder.testing.json1000.length; i++) {
			row = jOrder.testing.json1000[i];
			if (row.id === 107 || row.id === 115) {
				result.push(row);
			}
		}
		return result;
	}, function () {
		return db1000
			.find({'id': db77.isin([107, 115])})
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json1000)
			.equals('id', 107).or(115)
			.select();
	}, function () {
		return taffy1000
			.get({id: [107, 115]});
	});

	// Range search on 1000 rows
	jOB.test("'id' between 203 and 315", function () {
		return jorder1000.where([{ 'id': { lower: 202.9, upper: 315.1 } }], { mode: jOrder.range, renumber: true, limit: 1000 });
	}, function () {
		var result = [], i, row;
		for (i = 0; i < jOrder.testing.json1000.length; i++) {
			row = jOrder.testing.json1000[i];
			if (row.id >= 203 && row.id <= 315) {
				result.push(row);
			}
		}
		return result;
	}, function () {
		return db1000
			.find(db1000('id', '>= 203'), db1000('id', '<= 315'))
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json1000)
			.betweenEquals('id', 203, 315)
			.select();
	}, function () {
		var pass1 = taffy1000.get({id: {gte: 203}});
		return new TAFFY(pass1).get({id: {lte: 315}});
	});

	// Range search on 1000 rows with limit
	jOB.test("'id' between 203 and 315; hits #20 to #40", function () {
		return jorder1000.where([{ 'id': { lower: 203, upper: 315 } }], {
			mode: jOrder.range,
			renumber: true,
			offset: 20,
			limit: 20
		}, {renumber: true});
	}, function () {
		var result = [], i, row, counter = 0;
		for (i = 0; i < jOrder.testing.json1000.length; i++) {
			row = jOrder.testing.json1000[i];
			if (row.id >= 203 && row.id <= 315) {
				if (counter > 40) {
					break;
				} else if (counter < 20) {
					counter++;
					continue;
				} else {
					counter++;
					result.push(row);
				}
			}
		}
		return result;
	}, function () {
		return db1000
			.find(db1000('id', '>= 203'))
			.select('*')
			.slice(20, 40);
	}, function () {
		return jLinq.from(jOrder.testing.json1000)
			.betweenEquals('id', 203, 315)
			.skipTake(20, 20);
	}, function () {
		var pass1 = taffy1000.get({id: {gte: 203}});
		return new TAFFY(pass1)
			.get({id: {lte: 315}})
			.slice(20, 40);
	});
	
	// Freetext search on 1000 rows
	jOB.test("rows with 'name' field starting with \"con\"", function () {
		return jorder1000.where([{ 'name': 'con' }], { mode: jOrder.startof, indexName: 'fulltext', limit: 1000, renumber: true });
	}, function () {
		var result = [], i, row;
		for (i = 0; i < jOrder.testing.json1000.length; i++) {
			row = jOrder.testing.json1000[i];
			if (null !== row.name.match(/\bcon/i)) {
				result.push(row);
			}
		}
		return result;		
	}, function () {
		return db1000
			.find({'name': function (value) {
				return null !== value.match(/\bcon/i);
			}})
			.select('*');
	}, function () {
		return jLinq.from(jOrder.testing.json1000)
			.match('name', /\bcon/i)
			.select();
	}, function () {
		return taffy1000
			.get({'name': {regex: /\bcon/i}});
	});

	// Sorting on 1000 rows
	jOB.benchmark("Sorting on big table", "jOrder 1.2", "native", "db.js", "jLinq 3.0.1", "Taffy DB 1.7.3");
	jOB.test("by 'name'", function () {
		return jorder1000.orderby(['name'], jOrder.asc, { indexName: 'name' });
	}, function () {
		return jOrder.shallow(jOrder.testing.json1000).sort(function (a, b) {
			return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
		});
	}, function () {
		return db1000
			.order('name')
			.select('*');
	}, function () {
		return jLinq.from(jOrder.shallow(jOrder.testing.json1000))
			.sort('name')
			.select();
	}, function () {
		taffy1000j = jOrder.shallow(jOrder.testing.json1000);
		(new TAFFY(taffy1000j))
			.orderBy({'name': 'asc'});
		return taffy1000j;
	}, { lengthonly: true });

	// Sorting on 1000 rows, limited
	jOB.test("by 'name' (first 20 hits)", function () {
		return jorder1000.orderby(['name'], jOrder.asc, { indexName: 'name', offset: 0, limit: 20 });
	}, function () {
		return jOrder.shallow(jOrder.testing.json1000).sort(function (a, b) {
			return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
		}).slice(0, 20);
	}, function () {
		return db1000
			.order('name', 'asc')
			.select('*')
			.slice(0, 20);
	}, function () {
		return jLinq.from(jOrder.shallow(jOrder.testing.json1000))
			.sort('name')
			.take(20);
	}, function () {
		taffy1000j = jOrder.shallow(jOrder.testing.json1000);
		(new TAFFY(taffy1000j))
			.orderBy({'name': 'asc'});
		return taffy1000j
			.slice(0, 20);
	});
	
	jOrder.logging = false;
}(jQuery,
	jOrder,
	jOB));

