// Bee Events Invoicing - Service Worker
// Polls Firebase for new pending orders and fires notifications

var FB_URL = 'https://store-and-invoicing-default-rtdb.asia-southeast1.firebasedatabase.app';
var POLL_INTERVAL = 30000; // 30 seconds
var knownOrderIds = null; // null = first run, don't notify yet

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
  startPolling();
});

function startPolling() {
  poll();
  setInterval(poll, POLL_INTERVAL);
}

function poll() {
  fetch(FB_URL + '/store/pendingOrders.json')
    .then(function(r) { return r.json(); })
    .then(function(orders) {
      var list = orders || [];
      var currentIds = list.map(function(o) { return o.id; });

      if (knownOrderIds === null) {
        // First poll — just record what exists, no notifications
        knownOrderIds = currentIds;
        return;
      }

      // Find orders that are new since last poll
      var newOrders = list.filter(function(o) {
        return knownOrderIds.indexOf(o.id) === -1;
      });

      newOrders.forEach(function(o) {
        var title = 'New Order — ' + (o.custName || 'Customer');
        var body = o.items && o.items.length
          ? o.items.map(function(i) { return i.desc + ' x' + i.qty; }).join(', ')
          : 'Tap to view';
        self.registration.showNotification(title, {
          body: body,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          tag: o.id,
          renotify: false,
          data: { orderId: o.id }
        });
      });

      knownOrderIds = currentIds;
    })
    .catch(function() {
      // Network error - silently retry next interval
    });
}

// Tap notification -> open/focus the invoice app
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // If app is already open, focus it
        for (var i = 0; i < windowClients.length; i++) {
          if ('focus' in windowClients[i]) {
            return windowClients[i].focus();
          }
        }
        // Otherwise open it
        if (clients.openWindow) {
          return clients.openWindow('./invoice_v3.html');
        }
      })
  );
});
