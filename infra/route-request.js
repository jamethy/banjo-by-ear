// Rewrite only application routes. Missing audio, scripts, and other files
// retain their normal error responses instead of receiving HTML.
function handler(event) {
  var request = event.request;
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    (/^\/(saved|training)\/?$/.test(request.uri) ||
      /^\/pr\/[a-zA-Z0-9_-]{11}(\/[^/]+)?\/?$/.test(request.uri))
  ) {
    request.uri = "/index.html";
  }
  return request;
}
