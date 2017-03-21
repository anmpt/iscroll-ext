//******************************************************************************
//**  iScroll for ExtJS 4
//******************************************************************************
/**
 *   Simple script used to wrap ExtJS panels in an iScroll widget allowing
 *   mobile webkit clients (iPhone, iPad, etc) to scroll content inside a 
 *   fixed width/height element.
 *   
 *   This script was developed using ExtJS 4.0 and iScroll 4.2 and tested on
 *   an iPad 3 (iOS 6). More information on iScroll can be found here:
 *   http://cubiq.org/iscroll-4
 *
 *   This script is released under an MIT License.
 *   @author Peter Borissow
 *
 ******************************************************************************/

(function() {

  //**************************************************************************
  //** _afterRender
  //**************************************************************************
  /** Original afterRender method
   */
    var _afterRender = Ext.panel.Panel.prototype.afterRender;


  //**************************************************************************
  //** afterRender
  //**************************************************************************
  /** Overrides the Ext.panel.Panel afterRender and inserts an iScroll
   */
    Ext.override(Ext.panel.Panel, {

        afterRender: function() {
            _afterRender.apply(this, arguments);

            if (!this.verticalScroller){
                if (this.autoScroll==true){
                    this.setAutoScroll(false);
                    insertIScroll(this.el.dom, this);
                }
            }
            else{ //tables, grids, tree view, etc.

                if (this.initialConfig.autoScroll==false) return;

                var grid = this;
                var view = grid.view;
                var vScroller = grid.verticalScroller;
                grid.vScrollSize = null;
                var pagingGridScroller = (vScroller instanceof Ext.grid.PagingScroller);


                if (pagingGridScroller){
                    updatePagingGridScroller(grid);
                }



              //Override the show/hide scroller methods. Note that this is
              //causing issues for non-paging grid scrollers
                //grid.hideVerticalScroller = function(){}
                //grid.showVerticalScroller = function(){}


              //Override native scroll size calculation. This is our hook to
              //insert/update/remove the iScroll widget.
                vScroller.getSizeCalculation = function(){

                  //Compute height
                    var height = false;
                    if (pagingGridScroller){

                      //Get total number of records in the store
                        var store = grid.store;
                        var isFiltered = store.isFiltered();
                        if (isFiltered==null) isFiltered = false;
                        var fn = ((!store.remoteFilter && isFiltered) ? 'getCount' : 'getTotalCount');
                        if (store[fn]==null) fn = 'getCount';
                        var numRecords = store[fn]();

                        if (numRecords==null && fn == 'getTotalCount') numRecords = store.getCount();

                        if (isNaN(numRecords)) { //What kind of store doesn't report count!!!
                            if (store.tree){
                                numRecords = 0;
                                var arr = store.tree.flatten();
                                for (var i=0; i<arr.length; i++){
                                    if (arr[i].isVisible()) numRecords++;
                                }
                            }
                            else{
                                numRecords = 1;
                            }
                        }

                      //Multiply number of records by row height
                        if (!vScroller.rowHeight) {
                            var tr = view.el.down(view.getItemSelector());
                            vScroller.rowHeight = tr==null? 0 : tr.getHeight(false, true);
                        }
                        height = numRecords * vScroller.rowHeight;
                    }
                    
                    var size = {
                        height: height,
                        width: 1
                    }

                  //Save scroller size
                    if (grid.vScrollSize==null || grid.vScrollSize.height!=height){
                        grid.vScrollSize = size;
                        //console.log(size);
                        var table = view.el.dom.firstChild;
                        if (table!=null){
                            if (table.nodeName.toLowerCase()=="table"){
                                console.log("Insert iScroll!");
                                insertIScroll(table.parentNode, grid);
                            }
                            else{
                                if (grid.iScroll){
                                    console.log("Update iScroll!");
                                    table.style.height=height;
                                    grid.iScroll.refresh();
                                }
                            }
                        }
                    }
                    return size;
                };


//                var localStore = false;
//                if (grid.store!=null){
//                    if (grid.store.proxy!=null){
//                        localStore = (grid.store.proxy instanceof Ext.data.proxy.Memory);
//                    }
//                }
//
//                if (localStore){
//                    Ext.util.Observable.capture(grid, console.info);
//                }



              //Calculate scroll size after the table has been rendered
                view.on("refresh", function(){

                  //Added this line after discovering a bug with grids that are
                  //backed by a local store. In a nutshell, a store's add,
                  //remove, sort methods don't fire events until after the view
                  //has been refreshed. We need to invalidate the vScrollSize
                  //before these methods are called so we can update the DOM
                  //for iScroll. Invalidating the vScrollSize with every refresh
                  //event might be a performance issue b/c the refresh event is
                  //fired alot!
                    grid.vScrollSize = null;


                    vScroller.getSizeCalculation();
                });


              //Force recalculation of scroll size on load/sort. Need to test
              //whether this is redundant now that we are invalidating the
              //vScrollSize with every refresh event.
                //grid.store.on("beforeload", function(){
                //    grid.vScrollSize = null;
                //});


              //Special case for tree grids. Need to calculate scroll size
              //after nodes are expanded or collapsed.
                if (grid.store.tree){
                    grid.store.tree.on("expand", function(){
                        vScroller.getSizeCalculation();
                    });
                    grid.store.tree.on("collapse", function(){
                        vScroller.getSizeCalculation();
                    });
                }
            }
        }
    });//end panel override


  //**************************************************************************
  //** insertIScroll
  //**************************************************************************
  /** Used to wrap an Ext Panel with an iScroll widget.
   */
    var insertIScroll = function(contentWrapper, panel, options){

      //Special case for tables/grids
        if (contentWrapper.firstChild.nodeName.toLowerCase()=="table"){ //panel.viewType=="gridview"){

          //Update the DOM for iScroll
            var grid = panel;
            var table = grid.view.el.dom.firstChild;
            contentWrapper.removeChild(table);
            var div = document.createElement("div");
            div.style.height = grid.vScrollSize.height;
            div.appendChild(table);
            contentWrapper.appendChild(div);

          //Special case for grids with paging grid scrollers (e.g. infinite grids)
            if (grid.verticalScroller.xtype=="paginggridscroller"){
                if (options==null) options = {};
                options.onScrollEnd = function(e){
                    updateGrid(grid, this);
                }
            }

          //Special case for touch devices. Need to capture mouse click
          //events and update the selection model.
            if (typeof(window.ontouchstart)!='undefined'){
                div.onclick = function(e){
                
                    var clientX = e.clientX;
                    var clientY = e.clientY;
                    var x, y;
                    for (var i=0; i<grid.columns.length; i++){
                        var box = grid.columns[i].getBox();
                        if (clientX>=box.x && clientX<=(box.x+box.width)){
                            x = i;
                            break;
                        }
                    }
                    i=0;
                    var row = Ext.DomQuery.selectNode('tr[class*=x-grid-row]', table);
                    while(true){
                        if (i>0) row = row.nextSibling;
                        if (row==null) break;

                        if (row.nodeType == 1){
                            var box = Ext.get(row).getBox();
                            if (clientY>=(box.bottom-box.height) && clientY<=box.bottom){
                                y = i;
                                break;
                            }
                        }
                        i++;
                    }
                    //console.log("selected: " + x + ", " + y);
                    var record = grid.store.getAt(y);
                    grid.getSelectionModel().select(record);
                }
            }

        }//end grid specific logic


      //Update style of the contentWrapper
        if (contentWrapper.style.position!='absolute'){
            contentWrapper.style.position = 'absolute';
            contentWrapper.style.top =
            contentWrapper.style.bottom =
            contentWrapper.style.left =
            contentWrapper.style.right = 0;
        }


      //Update style of the parent node. Note that we are missing "-o-box-flex:1;".
        var content = contentWrapper.parentNode;
        content.style.webkitBoxFlex = //Safari ("-webkit-box-flex:1;")
        content.style.MozBoxFlex = //Firefox ("-moz-box-flex:1;")
        content.style.boxFlex=1; //Default ("box-flex:1;")


     //Update style of the child node. Note that we are missing "-o-box-sizing:border-box;".
        var contentScroller = contentWrapper.firstChild;
        contentScroller.style.webkitBoxSizing = //Safari ("-webkit-box-sizing:border-box;")
        contentScroller.style.MozBoxSizing = //Firefox ("-moz-box-sizing:border-box;")
        contentScroller.style.boxSizing = "border-box"; //Default ("box-sizing:border-box;")


      //Once the proper parent and child siblings are setup, insert iScroll
        panel.iScroll = new iScroll(contentWrapper.id, options);


      //Watch for resize events and update the iScroll container accordingly
        panel.addListener("resize", function() {
            var h = panel.iScroll.scrollerH;
            contentScroller.style.height=h;
        }, panel);

    };


  //**************************************************************************
  //** updatePagingGridScroller
  //**************************************************************************
  /** Used to override native methods and event listeners associated with a
   *  "Ext.grid.PagingScroller". 
   */
    var updatePagingGridScroller = function(grid){

        var view = grid.view;
        var store = grid.store;
        var vScroller = grid.verticalScroller;


      //Remove all event handlers associated with the paginggridscroller
        for (var eventName in store.events) {
            var event = store.events[eventName];
            if (event.listeners)
            for (var i=0; i<event.listeners.length; i++){
                var listener = event.listeners[i];
                for (var key in vScroller) {
                    var fn = vScroller[key];
                    if (typeof(fn) == "function") { //if (Ext.isFunction(fn)) {
                        if (fn+'' == listener.fn+''){
                            //console.log(event.name);
                            //console.log(listener.fn);
                            event.removeListener(listener.fn, listener.scope);
                            break;
                        }
                    }
                }
            }
        }


      //Remove native scroll methods
        vScroller.syncTo = function(){};
        vScroller.onElScroll = function(){};


      //Update store.load() to call guaranteeRange()
        store.load = function(options){

            options = options || {};

            if (typeof options == 'function') {
                options = {
                    callback: options
                };
            }


            store.removeAll(false);
            store.prefetchData.clear();
            store.totalCount = store.pageSize;
            store.guaranteedStart = store.guaranteedEnd = -1;
            store.guaranteeRange(0, store.pageSize, options.callback, options.scope);
        };


      //Create new listener to watch for load events. This method bypasses
      //the normal rendering routines and
        store.on("guaranteedrange", function(records, rangeStart, rangeEnd){

            if (rangeStart<0 || rangeEnd<0) return;
            if (rangeStart>store.getTotalCount()) return;


            if (vScroller.loading==true) return;
            vScroller.loading = true;

            
            var isNew = store.getCount()<1;


          //Add records to the store (vs store.loadRecords())
            store.data.addAll(records);
            var i = 0;
            for (; i < records.length; i++) {
                records[i].join(store);
            }


          //Get/create table
            var table = Ext.DomQuery.selectNode('table', view.el.dom);
            if (isNew || table==null){
                view.tpl.overwrite(view.getTargetEl(), view.collectData(records, 0));
                table = Ext.DomQuery.selectNode('table', view.el.dom);
                isNew = true;
            }

          //Get rows in the table
            var firstRow = Ext.DomQuery.selectNode('tr', table);
            var rows = [];
            var n = firstRow;
            while (true){
                n = n.nextSibling;
                if (n==null) break;
                if (n.nodeType==1) rows.push(n);
            }
            //console.log("orgRows: " + rows.length);

          //Create empty rows
            var numCols = 0;
            for (i=0; i<firstRow.childNodes.length; i++){
                if (firstRow.childNodes[i].nodeType==1) numCols++;
            }
            var emptyRow = document.createElement('tr');
            var td = document.createElement('td');
            td.style.height = vScroller.rowHeight;
            td.setAttribute("colspan",numCols);
            emptyRow.appendChild(td);
            if (rows.length<rangeEnd){
                for (i=rows.length; i<rangeEnd; i++){
                    rows.push(emptyRow);
                }
            }
            if (isNew && rangeStart>0){ //not tested...
                var arr = [];
                for (i=0; i<rangeStart; i++) {
                    arr.push(emptyRow);
                }
                for (i=0; i<rows.length; i++) {
                    arr.push(rows[i]);
                }
                rows = arr;
            }
            //console.log("newRows: " + rows.length);

          //Add missing rows
            if (!isNew){
                var html = view.tpl.applyTemplate(view.collectData(records, 0));
                var div = document.createElement('div');
                div.innerHTML = html;
                var row = Ext.DomQuery.selectNode('tr', div.firstChild);
                var newRows = [];
                n = row;
                while (true){
                    n = n.nextSibling;
                    if (n==null) break;
                    if (n.nodeType==1) newRows.push(n);
                }
                //console.log("  Updating " + newRows.length + " rows...");


                for (i=0; i<newRows.length; i++) {
                    rows[i+rangeStart] = newRows[i];
                }
            }

          //Update the DOM
            var tbody = firstRow.parentNode;
            while (tbody.hasChildNodes()) {
                tbody.removeChild(tbody.lastChild);
            }
            tbody.appendChild(firstRow);
            for (i=0; i<rows.length; i++) {
                tbody.appendChild(rows[i]);
            }

          //Magical code required for the grid selection model
            view.all.fill(Ext.query(view.getItemSelector(), view.el.dom));
            view.updateIndexes(0);

            if (store.data.getCount()!=rows.length){
                console.log("WARNING! " + store.data.getCount() + " vs " + rows.length);
            }

          //Compute scroller size
            vScroller.getSizeCalculation();
            vScroller.loading = false;
        });
    };


  //**************************************************************************
  //** updateGrid
  //**************************************************************************
  /** Used to sync the grid to the scroll position
   */
    var updateGrid = function(grid, iScroll){

        var view = grid.view;
        var store = grid.store;
        var vScroller = grid.verticalScroller;


        var y = iScroll.wrapperOffsetTop-Ext.get(iScroll.scroller).getBox().y;
        if (y<0) y = 0;

        var visibleStart = Math.floor(y / vScroller.rowHeight);
        if (visibleStart==vScroller.visibleStart) return;
        vScroller.visibleStart = visibleStart;


        var me = vScroller;
        var pageSize = store.pageSize,
            //guaranteedStart = store.guaranteedStart,
            //guaranteedEnd = store.guaranteedEnd,
            totalCount = store.getTotalCount(),
            numFromEdge = Math.ceil(me.percentageFromEdge * pageSize),
            //position = scrollTop, //t.scrollTop,
            //visibleStart = Math.floor(position / me.rowHeight),
            //view = panel.down('tableview'),
            viewEl = view.el,
            visibleHeight = viewEl.getHeight(),
            visibleAhead = Math.ceil(visibleHeight / me.rowHeight),
            visibleEnd = visibleStart + visibleAhead,
            prevPage = Math.floor(visibleStart / pageSize),
            nextPage = Math.floor(visibleEnd / pageSize) + 2,
            lastPage = Math.ceil(totalCount / pageSize),
            //snap = me.snapIncrement,
            //requestStart = visibleStart, //Math.floor(visibleStart / snap) * snap,
            //requestEnd = requestStart + pageSize - 1,
            activePrefetch = me.activePrefetch
            ;


        var guaranteedStart = (Math.floor(visibleEnd / pageSize)*pageSize);
        var guaranteedEnd = guaranteedStart+pageSize;
        //console.log(visibleStart + "-" + visibleEnd + " guaranteedRange: " + guaranteedStart + "-" + guaranteedEnd);

        
        guaranteedStart++;
        var rangeSatisfied = isRangeSatisfied(store, guaranteedStart, guaranteedEnd);
        //console.log("rangeSatisfied: " + guaranteedStart + "-" + guaranteedEnd + "? " + rangeSatisfied);
        if (!vScroller.loading && !rangeSatisfied){
            store.guaranteeRange(guaranteedStart, guaranteedEnd);
        }
    };


  //**************************************************************************
  //** isRangeSatisfied
  //**************************************************************************
  /** Used to determine whether the store has a given range of records. This
   *  is used when scrolling
   */
    var isRangeSatisfied = function(store, start, end) {

      //Check whether the records have been prefetched
        if (store.rangeSatisfied(start, end)){

          //Check whether the store has the records
            var i = start,
                satisfied = true;

            for (; i < end; i++) {
                if (!store.data.getByKey(i)) {
                    satisfied = false;
                    break;
                }
            }
            return satisfied;
        }
        else{
            if (start<0 || end<0) return true;
            if (start>store.getTotalCount()) return true;
            return false;
        }
    };

})();
