////////////////////////////////////////////////////////////////////////////////
// jOrder index object
////////////////////////////////////////////////////////////////////////////////
/*global jOrder */

jOrder.table = function (core, constants, logging) {
	var
	
	// selectors for table.filter()
	selectors = {
		// selects exact matches
		// handles multiple conditions
		exact: function (row, data) {
			var match = false,
					partial, condition,
					i, field;
			for (i = 0; i < data.conditions.length; i++) {
				partial = true;
				condition = data.conditions[i];
				for (field in condition) {
					if (condition.hasOwnProperty(field)) {
						partial &= (condition[field] === row[field]);
						if (!partial) {
							break;
						}
					}
				}
				match |= partial;
				if (match) {
					break;
				}
			}
			return match;
		},
		
		// selectes start of word matches
		// only first condition is processed
		startof: function (row, data) {
			var kv = core.split(data.conditions[0]);
			return row[kv.keys[0]].indexOf(kv.values[0]) === 0;
		},
		
		// selects range of values
		// only first condition is processed
		range: function (row, data) {
			var kv = core.split(data.conditions[0]),
					bounds = kv.values[0],
					field = kv.keys[0];
			return bounds.lower <= row[field] && bounds.upper > row[field];
		}
	};
	
	// indexed table object
	// - data: json table the table object is based on
	// - options:
	return function (json, options) {
		options = options || { renumber: false };

		// member variables
		var indexes = {},
		
		self = {
			// checks whether index exists and returns that index
			// - name: index name
			checkIndex: function (name) {
				if (!indexes.hasOwnProperty(name)) {
					logging.warn("Invalid index name: '" + name + "'");
					return false;
				}
				return indexes[name];
			},
					
			// looks up an index according to the given fields
			// - indexName: name of index to look up
			// - options:
			//   - row: sample row that's supposed to match the index
			//   - grouped: whether the index in question should be
			findIndex: function (indexName, options) {
				options = options || {};
				
				// looking up by index
				if (indexName) {
					return self.checkIndex(indexName);
				}
				
				var name, index;
				for (name in indexes) {
					if (indexes.hasOwnProperty(name)) {
						index = indexes[name];
						if ((typeof options.row === 'undefined' || index.signature(options.row, true)) &&
							(typeof options.grouped === 'undefined' || index.grouped() === options.grouped)) {
							return index;
						}
					}
				}
				return null;
			},
		
			// creates or gets an index
			// - name: index name
			// - fields: array of strings representing table fields
			// - options: index options (groupability, sortability, type, etc.)
			index: function (name, fields, options) {
				// reindexing table on no args at all 
				if (!name) {
					return self.reindex();
				}
				// looking up index when only name arg is given
				if (!fields) {
					return indexes[name];
				}
				// adding index to table (and optionally removing previous)
				if (indexes.hasOwnProperty(name)) {
					logging.warn("Overwriting existing index '" + name + "'");
					delete indexes[name];
				}
				indexes[name] = jOrder.index(json, fields, options);
				return self;
			},
	
			// rebuilds all indexes on table
			reindex: function () {
				var name;
				for (name in indexes) {
					if (indexes.hasOwnProperty(name)) {
						indexes[name].rebuild();
					}
				}
				return self;
			},
	
			// resets table to its original state
			// except for field changes within the original json
			clear: function () {
				indexes = {};
				return self;
			},
	
			// updates, inserts or deletes one row in the table, modifies indexes
			// - before: data row
			// - after: changed data row
			// - options: [indexName]
			update: function (before, after, options) {
				options = options || {};
	
				var index = self.findIndex(options.indexName, {grouped: false}),
						i,
						oldId, newId,
						name;
	
				// obtaining old row
				if (before) {
					if (!index) {
						throw "Can't find suitable index for fields: '" + core.keys(before).join(",") + "'.";
					}
					oldId = index.lookup([before])[0];
					before = json[oldId];
				}
	
				// updating json
				if (typeof oldId === 'undefined') {
					// inserting new
					if (!after) {
						logging.warn("Update called but nothing changed.");
						return self;
					}
					newId = json.push(after) - 1;
				} else {
					// deleting old
					delete json[oldId];
					// inserting new
					if (after) {
						newId = json.push(after) - 1;
					}
				}
	
				// updating indexes
				for (name in indexes) {
					if (indexes.hasOwnProperty(name)) {
						index = indexes[name];
						if (before) {
							index.remove(before, oldId);
						}
						if (after) {
							index.add(after, newId);
						}
					}
				}
				return self;
			},
	
			// inserts a row into the table, updates indexes
			// - rows: table rows to be inserted
			// - options: [indexName]
			insert: function (rows, options) {
				var i;
				for (i = 0; i < rows.length; i++) {
					self.update(null, rows[i], options);
				}
				return self;
			},
	
			// deletes row from table, updates indexes
			// - rows: table rows to delete
			// - options: [indexName]
			remove: function (rows, options) {
				var i;
				for (i = 0; i < rows.length; i++) {
					self.update(rows[i], null, options);
				}
				return self;
			},
	
			// selects specific rows from table preserving row ids or not
			// return value is always array (tight or dense)
			// - rowIds: specifies which rows to include in the result
			// - options:
			//	 - renumber: whether or not to preserve row ids
			select: function (rowIds, options) {
				// default options
				options = options || {};
	
				var result = [],
						i, rowId;
	
				// constructing result set
				if (options.renumber) {
					for (i = 0; i < rowIds.length; i++) {
						result.push(json[rowIds[i]]);
					}
				} else {
					for (i = 0; i < rowIds.length; i++) {
						rowId = rowIds[i];
						result[rowId] = json[rowId];
					}
				}
				return result;
			},
	
			// returns the first row as json table from the table fitting the conditions
			// - conditions: list of field-value pairs defining the data we're looking for; can be null = no filtering
			//	 (fields must be in the same exact order as in the index)
			// - options:
			//	 - indexName: index to use for search
			//	 - mode: constants.exact, constants.range, constants.startof (not unicode!)
			//	 - renumber: whether or not to preserve row ids
			//	 - offset: search offset
			//	 - limit: munber of rows to return starting from offset
			where: function (conditions, options) {
				// default options
				options = options || {};
	
				var index = self.findIndex(options.indexName, {row: conditions[0]}),
						rowIds, condition, range,
						lower, upper,
						selector;

				// index found, returning matching row by index
				if (index) {
					// obtaining row IDs for result
					switch (options.mode) {
					case constants.range:
						condition = conditions ? core.values(conditions[0])[0] : null;
						if (condition) {
							range = typeof condition === 'object' ? condition : {lower: condition, upper: condition};
							rowIds = index.range({
								lower: range.lower,
								upper: range.upper
							}, options);
						} else {
							rowIds = {lower: null, upper: null};
						}
						break;
					case constants.startof:
						condition = conditions ? core.values(conditions[0])[0] : null;
						lower = condition ? condition : null;
						upper = lower ? lower + 'z' : null;
						rowIds = index.range({ lower: lower, upper: upper }, options);
						break;
					default:
					case constants.exact:
						// when offset and/or limit is specified, exact mode is not likely to work
						if (options.offset || options.limit) {
							logging.warn("Running 'jOrder.table.where()' in 'exact' mode with offset and limit specified. Consider running it in 'range' mode.");
						}
						// when no conditions are set
						rowIds = conditions ?
							index.lookup(conditions) :
							core.values(index.flat()); // what about grouped index?
						break;
					}
					
					// building result set based on collected row IDs
					return self.select(rowIds, { renumber: options.renumber });
				} else {
					// no index found, searching iteratively
					logging.warn("No matching index for fields: '" + core.keys(conditions[0]).join(',') + "'.");
					
					// obtaining suitable selector
					switch (options.mode) {
					case constants.range:
						selector = selectors.range;
						break;
					case constants.startof:
						selector = selectors.startof;
						break;
					default:
					case constants.exact:
						selector = selectors.exact;
						break;
					}
					
					// running iterative filter with found selector
					return self.filter(selector, options, {conditions: conditions});
				}
			},
	
			// aggregates the table using a group index
			// - indexName: name of the group index
			// - initCallback: function that initializes the aggregated row
			// - iterateCallback: function performing one step of iteration
			aggregate: function (indexName, initCallback, iterateCallback) {
				var result = [],
						index,
						groupIndex, groupId, group, seed, rowId, aggregated,
						i;				

				// checking index
				if (!indexes.hasOwnProperty(indexName)) {
					throw "Index '" + indexName + "' not found.";
				}
				if (!(index = indexes[indexName]).grouped()) {
					throw "Can't aggregate using a non-group index! Signature: '" + index.signature() + "'.";
				}
				logging.warn("jOrder.table.aggregate() iterates over the table (length: " + json.length + ").");
	
				// cycling through groups according to index
				groupIndex = index.flat();
				result = [];
				for (groupId in groupIndex) {
					if (groupIndex.hasOwnProperty(groupId)) {
						// initializing aggregated row (seed)
						group = groupIndex[groupId].items;
						for (rowId in group) {
							if (group.hasOwnProperty(rowId)) {
								seed = json[group[rowId]];
								break;
							}
						}
						aggregated = initCallback(core.shallow([seed])[0]);
		
						// iterating through each row in group
						for (rowId in group) {
							if (group.hasOwnProperty(rowId)) {
								aggregated = iterateCallback(aggregated, json[group[rowId]]);
							}
						}
						// adding aggregated group to result
						result[groupId] = aggregated;
					}
				}
	
				return result;
			},
	
			// sorts the contents of the table according to an index
			// - fields: array of field names to sort by
			// - direction: constants.asc or constants.desc
			// - options:
			//	 - indexName: name of the index to use for sorting
			//	 - compare: comparer callback (UNUSED)
			//	 - offset
			//	 - limit
			orderby: function (fields, direction, options) {
				// default options
				options = options || {};
	
				var index = self.findIndex(options.indexName, {row: core.join(fields, [])}),
						order;
				
				// checking if index
				if (constants.text === index.type()) {
					throw "Can't order by free-text index: '" + fields.join(',') + "'.";
				}
				// assess sorting order
				order = index.order(direction, options);
				if (!order) {
					// sorting on the fly
					logging.warn("Index '" + options.indexName + "' is not ordered. Sorting index on the fly.");
					return core.shallow(json).sort(function (a, b) {
						return a[fields[0]] > b[fields[0]] ? 1 : a[fields[0]] < b[fields[0]] ? -1 : 0;
					});
				}
	
				// gathers row ids, compacts index if necessary
				function rowIds() {
					var result = [],
							i;
					
					function restart() {
						index.compact();
						order = index.order(direction, options);
						return rowIds();
					}
	
					for (i = 0; i < order.length; i++) {
						// dealing with fragmented order
						if (!(order[i].rowId in json)) {
							return restart();
						}
						result.push(order[i].rowId);
					}
					return result;
				}
	
				// returning ordered rows
				return self.select(rowIds(), { renumber: true });
			},
	
			// filters table rows using the passed selector function
			// runs the selector on each row of the table
			// returns a json table
			// - selector: function that takes the row (object) as argument and returns a bool
			// - options:
			//	 - renumber: whether to preserve original row ids
			//	 - offset
			//	 - limit
			filter: function (selector, options, data) {
				// issuing warning
				logging.warn("Performing linear search on table (length: " + json.length + "). Consider using an index.");
	
				// applying default options
				options = options || {};
				options.offset = options.offset || 0;
	
				// initializing result
				var result = [],
						i, row, counter = 0;

				// sweeping entire table and selecting suitable rows
				for (i in json) {
					if (json.hasOwnProperty(i) && selector(row = json[i], data)) {
						if (counter++ >= options.offset) {
							if (options.renumber) {
								result.push(row);
							} else {
								result[i] = row;
							}
						}
						if (options.limit && counter === options.offset + options.limit) {
							break;
						}
					}
				}
				return result;
			},
	
			// counts the lements in the table
			count: function () {
				logging.warn("jOrder.table.count() iterates over the table (length: " + json.length + ").");
				return core.keys(json).length;
			},
	
			// returns a copy of the flat contents of the table
			flat: function () {
				return json;
			},
	
			// get the first row from table
			first: function () {
				var i;
				for (i in json) {
					if (json.hasOwnProperty(i)) {
						return json[i];
					}
				}
			},
	
			// returns one column of the table as a flat array
			// - field: field name identifying the column
			// - options:
			//	 - renumber: whether or not it should preserve row ids
			column: function (field, options) {
				// default options
				options = options || {};
	
				var result = [],
						i;
				if (options.renumber) {
					for (i in json) {
						if (json.hasOwnProperty(i)) {
							result.push(json[i][field]);
						}
					}
					return result;
				}
				for (i in json) {
					if (json.hasOwnProperty(i)) {
						result[i] = json[i][field];
					}
				}
				return result;
			},
	
			// tells whether there's an ordered index on the given combination of fields
			ordered: function (fields) {
				var index = self.findIndex(null, {row: fields});
				if (!index) {
					return false;
				}
				return index.ordered();
			},
	
			// tells whether there's an ordered index on the given combination of fields
			grouped: function (fields) {
				var index = self.findIndex(null, {row: fields});
				if (!index) {
					return false;
				}
				return index.grouped();
			}
		};
		
		return self;
	};
}(jOrder.core,
	jOrder.constants,
	jOrder.logging);

