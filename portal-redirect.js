const destination=new URL('company.html',location.href);
destination.hash=location.hash;
location.replace(destination.href);
