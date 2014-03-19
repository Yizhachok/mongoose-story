# Mongoose Story

## Using

Sample usage example

```js
var mongoose=require('mongoose'),
	story=require('mongoose-story'),
	Schema=mongoose.Schema;

mongoose.connect('mongodb://localhost/test');

// Config story module
story.setMongoose(mongoose);
// If need manual set history model builder (mongoose, connection, etc.)
story.setModelBuilder(mongoose);

var Article=new Schema({
	title:String,
	text:String,
	time:Date
});

Article.plugin(story,{
	fieldsInclude:'title text'
});
```

## API

### Main

For module object

- **setMongoose(mongoose)** - Set mongoose module (and builder if not defined)
- **setModelBuilder(builder)** - Set collection builder (can be connection or mongoose)

### Model

For model

- **historyModel()** - Return history model for current model
- **clearHistory(callback)** - Clear history collection. Callback receive `err` argument

### Document

For document

- **rollBackId(id,callback)** - Return history model for current model