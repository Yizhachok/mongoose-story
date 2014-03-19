'use strict';

var mongooseObjectTransformers=require('mongoose-transformers'),
	mongooseModule=require('mongoose'),
	modelBuilder=mongooseModule,
	_=require('lodash'),
	customMerge=_.partialRight(_.merge,function(oldVal,newVal){
		return _.isArray(newVal)?newVal:undefined;
	});

/**
 * Create and define history model
 * @param {string} name History model&collection name
 * @param {string} modelName Main model name
 * @param opt Config options
 * @returns {*}
 */
function createHistoryModel(name,modelName,opt){
	var schema=new mongooseModule.Schema({
		did:{ // Document id
			type:opt.idType,
			index:true,
			required:true,
			ref:modelName
		},
		time:{ // Edit time
			type:Date,
			default:Date.now,
			index:true,
			required:true
		},
		action:{ // Action type
			type:String,
			enum:'create update roll-back delete'.split(' '),
			trim:true,
			lowercase:true,
			required:true
		},
		rollBack:{
			type:mongooseModule.Schema.Types.ObjectId,
			ref:name
		},
		data:mongooseModule.Schema.Types.Mixed // Document data
	},{id:false,versionKey:false});

	return modelBuilder.model(name,schema,name);
}

/**
 * History plugin
 * @param schema
 * @param {Object|null|undefined} [opt] Config options
 * @param {string} [opt.suffix='-history'] Suffix for history collection
 * @param {*} [opt.idType] ID type of document
 * @param {Object} [opt.dump] Dump config
 * @param {string|undefined} [opt.dump.fieldsInclude=undefined] Fields to include in dump (or dump all doc by default)
 * @param {string|undefined} [opt.dump.fieldsExclude=undefined] Fields to exclude from dump (or dump all doc by default)
 */
function mongooseHistoryPlugin(schema,opt){
	opt=opt||{};
	/** Define default collection suffix */
	if(!opt.suffix) opt.suffix='-history';
	/** Define default id type of document */
	if(!opt.idType) opt.idType=mongooseModule.Schema.Types.ObjectId;

	/** Dump configuration object */
	if(!opt.dump) opt.dump={};
	/** Dump modified only */
	// if(!_.isBoolean(opt.dump.modified)) opt.dump.modified=false; TODO

	/** Configure toObject transformer */
	opt.dump.toObject=
		_.isString(opt.dump.fieldsInclude)?
			mongooseObjectTransformers.buildShow(opt.dump.fieldsInclude):
			_.isString(opt.dump.fieldsExclude)?
				mongooseObjectTransformers.buildHide(opt.dump.fieldsExclude):
				undefined;

	var historyModel;
	function getHistoryModel(collectionName,modelName){
		return historyModel||(historyModel=createHistoryModel(collectionName+opt.suffix,modelName,opt));
	}

	/**
	 * Return history model for current model
	 * @returns {*}
	 */
	schema.statics.historyModel=function(){
		return getHistoryModel(this.collection.name,this.modelName);
	};

	/**
	 * Clean all history
	 * @param {function} callback
	 */
	schema.statics.clearHistory=function(callback){
		getHistoryModel(this.collection.name,this.modelName).remove({},callback);
	};

	/**
	 * Roll back to timestamp
	 * @param {Date} time
	 * @param {function} callback
	 */
	// TODO
	/*schema.methods.rollBackTime=function(time,callback){
		var self=this,
			options={lean:true,sort:{time:1}},
			model=this.constructor;

		if(!(time instanceof Date)) time=new Date(time);

		getHistoryModel(model.collection.name,model.modelName)
			.find({did:this._id,time:{$lte:time}},null,options,function(err,docs){
				if(err) callback(err);
				else if(docs.length>0){
					var dest={};
					docs.forEach(function(doc){
						customMerge(dest,doc.data);
					});
					self.set(dest);
					self.__rollBack=docs[docs.length-1]._id;
					self.save(callback);
				}
				else callback();
			});
	};*/
	/**
	 * Roll back to document
	 * @param id
	 * @param {function} callback
	 */
	schema.methods.rollBackId=function(id,callback){
		var self=this,
			model=this.constructor;

		getHistoryModel(model.collection.name,model.modelName)
			.findOne({_id:id,did:this._id},'_id data',{lean:true},function(err,doc){
				if(err) callback(err);
				else if(doc){
					self.set(doc.data);
					self.__rollBack=doc._id;
					self.save(callback);
				}
				else callback();
			});
	};

	schema.pre('save',function(next){
		var model=this.constructor,
			docData=this.toObject(opt.dump.toObject);

		/** Dump modified only root paths */
		// TODO
		/*if(opt.dump.modified){
			var self=this;
			Object.keys(docData).forEach(function(key){
				if(!self.isModified(key)) delete docData[key];
			});
		}*/

		docData={
			did:this._id,
			action:this.isNew?'create':'update',
			data:docData
		};

		if(this.__rollBack){
			docData.action='roll-back';
			docData.rollBack=this.__rollBack;
		}
		/** Create new history record */
		new (getHistoryModel(model.collection.name,model.modelName))(docData).save(next);
	});

	schema.pre('remove',function(next){
		var model=this.constructor;

		new (getHistoryModel(model.collection.name,model.modelName))({
			did:this._id,
			action:'delete'
		}).save(next);
	});
}

/**
 * Set model builder
 * @param builder
 */
mongooseHistoryPlugin.setModelBuilder=function(builder){
	modelBuilder=builder;
};

/**
 * Set mongoose module and if not defined then model builder
 * @param mongoose
 */
mongooseHistoryPlugin.setMongoose=function(mongoose){
	mongooseModule=mongoose;
	if(!modelBuilder) modelBuilder=mongoose;
};

module.exports=mongooseHistoryPlugin;