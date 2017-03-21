Simple script used to wrap ExtJS panels in an iScroll widget allowing
mobile webkit clients (iPhone, iPad, etc) to scroll content inside a 
fixed width/height element.

To use the script simply include iScroll and the iscroll-ext.js script. Example:

if (( navigator.userAgent.match(/(iPad|iPhone|iPod)/i) ? true : false )){
    document.write('<script type="text/javascript" src="iscroll/iscroll.js"></script>');
    document.write('<script type="text/javascript" src="iscroll/iscroll-ext.js"></script>');
}


This script was developed using ExtJS 4.0 and iScroll 4.2 and tested on
an iPad (iOS 6-9). More information on iScroll can be found here:
http://cubiq.org/iscroll-4

This script is released under an MIT License.
