using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Retroscope.Api.Controllers;

/// <summary>
/// Generic proxy controller that forwards all requests to Supabase PostgREST API.
/// This controller is agnostic to data types and simply passes through requests and responses.
/// </summary>
[ApiController]
[Route("api/supabase/{**path}")]
[Authorize]
public class SupabaseProxyController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SupabaseProxyController> _logger;

    public SupabaseProxyController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<SupabaseProxyController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Forwards any HTTP request to Supabase PostgREST API or Edge Functions.
    /// Supports GET, POST, PATCH, PUT, DELETE, and other HTTP methods.
    /// </summary>
    [HttpGet]
    [HttpPost]
    [HttpPatch]
    [HttpPut]
    [HttpDelete]
    [HttpHead]
    [HttpOptions]
    [AllowAnonymous]  // Allow public auth endpoints; we check authorization manually in the method
    public async Task<IActionResult> ProxyRequest(string? path = null)
    {
        try
        {
            // Determine the request type based on the path
            var isEdgeFunctionRequest = path?.StartsWith("functions/", StringComparison.OrdinalIgnoreCase) ?? false;
            var isStorageRequest = path?.StartsWith("storage/v1/", StringComparison.OrdinalIgnoreCase) ?? false;
            var isAuthRequest = path?.StartsWith("auth/v1/", StringComparison.OrdinalIgnoreCase) ?? false;
            
            // Check for auth header (not required for certain auth endpoints)
            var authHeader = Request.Headers.Authorization.ToString();
            var isPublicAuthEndpoint = isAuthRequest && IsPublicAuthEndpoint(path);
            
            if (string.IsNullOrEmpty(authHeader) && !isPublicAuthEndpoint)
            {
                return Unauthorized(new { error = "Authorization header is required" });
            }

            // Get correlation ID
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                                ?? Request.Headers["Request-Id"].FirstOrDefault()
                                ?? Guid.NewGuid().ToString();

            // Determine the client name based on request type
            string clientName;
            if (isEdgeFunctionRequest)
                clientName = "FunctionsClient";
            else if (isStorageRequest)
                clientName = "StorageClient";
            else if (isAuthRequest)
                clientName = "AuthClient";
            else
                clientName = "PostgrestClient";

            // Build the Supabase request
            var supabaseRequest = await BuildSupabaseRequest(path ?? string.Empty, authHeader, correlationId, isEdgeFunctionRequest, isStorageRequest, isAuthRequest);

            // Send the request to Supabase
            var client = _httpClientFactory.CreateClient(clientName);
            _logger.LogInformation("Proxying {Method} request to: {BaseAddress}{RequestUri} (using {ClientName})", 
                Request.Method, client.BaseAddress, supabaseRequest.RequestUri, clientName);
            _logger.LogDebug("Request headers: Authorization={HasAuth}, apikey={HasApiKey}, Accept={Accept}", 
                supabaseRequest.Headers.Authorization != null, 
                supabaseRequest.Headers.Contains("apikey"),
                supabaseRequest.Headers.Accept.ToString());
            var response = await client.SendAsync(supabaseRequest);

            // Forward the response back to the client
            return await ForwardResponse(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying request to Supabase");
            return StatusCode(502, new { error = "Failed to proxy request to Supabase", details = ex.Message });
        }
    }

    /// <summary>
    /// Determines if an auth endpoint is public (doesn't require authentication).
    /// </summary>
    private bool IsPublicAuthEndpoint(string? path)
    {
        if (string.IsNullOrEmpty(path))
            return false;

        var lowerPath = path.ToLowerInvariant();
        
        // Public auth endpoints that don't require prior authentication
        return lowerPath.Contains("/token") ||           // Sign in, refresh token
               lowerPath.Contains("/signup") ||          // Sign up
               lowerPath.Contains("/recover") ||         // Password recovery
               lowerPath.Contains("/verify") ||          // Email verification
               lowerPath.Contains("/authorize");         // OAuth authorization
    }

    /// <summary>
    /// Builds an HTTP request to forward to Supabase or local PostgREST.
    /// </summary>
    private async Task<HttpRequestMessage> BuildSupabaseRequest(string path, string authHeader, string correlationId, bool isEdgeFunctionRequest, bool isStorageRequest, bool isAuthRequest)
    {
        var supabaseAnonKey = _configuration["SUPABASE_ANON_KEY"];

        // Remove leading slash to ensure it's treated as a relative URI
        // (HttpClient with BaseAddress requires relative URIs without leading slash)
        path = path.TrimStart('/');

        // For Edge Functions, strip the "functions/" prefix since the FunctionsClient base URL includes it
        if (isEdgeFunctionRequest && path.StartsWith("functions/", StringComparison.OrdinalIgnoreCase))
        {
            path = path.Substring("functions/".Length);
        }

        // For Storage, strip the "storage/v1/" prefix since the StorageClient base URL includes it
        if (isStorageRequest && path.StartsWith("storage/v1/", StringComparison.OrdinalIgnoreCase))
        {
            path = path.Substring("storage/v1/".Length);
        }

        // For Auth, strip the "auth/v1/" prefix since the AuthClient base URL includes it
        if (isAuthRequest && path.StartsWith("auth/v1/", StringComparison.OrdinalIgnoreCase))
        {
            path = path.Substring("auth/v1/".Length);
        }

        // Preserve query string
        var queryString = Request.QueryString.HasValue ? Request.QueryString.Value : string.Empty;
        var requestUri = $"{path}{queryString}";

        var request = new HttpRequestMessage(new HttpMethod(Request.Method), requestUri);

        // Forward the authorization header using the typed property
        if (!string.IsNullOrEmpty(authHeader))
        {
            request.Headers.Authorization = System.Net.Http.Headers.AuthenticationHeaderValue.Parse(authHeader);
        }

        // Add Supabase API key
        if (!string.IsNullOrEmpty(supabaseAnonKey))
        {
            request.Headers.TryAddWithoutValidation("apikey", supabaseAnonKey);
        }

        // Ensure Accept header is set
        request.Headers.TryAddWithoutValidation("Accept", "application/json");

        // Forward correlation ID
        request.Headers.TryAddWithoutValidation("X-Correlation-Id", correlationId);

        // Forward relevant headers from the original request
        ForwardRequestHeaders(request, isEdgeFunctionRequest, isStorageRequest, isAuthRequest);

        // Forward request body if present
        if (Request.ContentLength > 0 && Request.Body.CanRead)
        {
            var bodyStream = new MemoryStream();
            await Request.Body.CopyToAsync(bodyStream);
            bodyStream.Position = 0;

            request.Content = new StreamContent(bodyStream);

            // Forward content type
            if (Request.ContentType != null)
            {
                request.Content.Headers.TryAddWithoutValidation("Content-Type", Request.ContentType);
            }
        }

        return request;
    }

    /// <summary>
    /// Forwards relevant headers from the incoming request to the Supabase request.
    /// </summary>
    private void ForwardRequestHeaders(HttpRequestMessage supabaseRequest, bool isEdgeFunctionRequest, bool isStorageRequest, bool isAuthRequest)
    {
        // Headers to forward (excluding those we handle separately)
        var headersToForward = new List<string>
        {
            "Accept",
            // Don't forward Accept-Encoding - let HttpClient handle compression automatically
            "Accept-Language",
            "X-Tenant",
        };

        // PostgREST-specific headers
        if (!isEdgeFunctionRequest && !isStorageRequest && !isAuthRequest)
        {
            headersToForward.Add("Prefer"); // Important for PostgREST (return=representation, resolution=merge-duplicates, etc.)
            headersToForward.Add("Range");
        }

        // Storage-specific headers
        if (isStorageRequest)
        {
            headersToForward.Add("Cache-Control");
            headersToForward.Add("x-upsert"); // Supabase storage upsert header
        }

        foreach (var headerName in headersToForward)
        {
            if (Request.Headers.TryGetValue(headerName, out var headerValue))
            {
                supabaseRequest.Headers.TryAddWithoutValidation(headerName, headerValue.ToArray());
            }
        }
    }

    /// <summary>
    /// Forwards the Supabase response back to the client.
    /// </summary>
    private async Task<IActionResult> ForwardResponse(HttpResponseMessage supabaseResponse)
    {
        // Read response content
        var content = await supabaseResponse.Content.ReadAsStringAsync();
        _logger.LogInformation("Supabase response: Status={StatusCode}, ContentLength={Length}", 
            supabaseResponse.StatusCode, content.Length);

        // Set response status code directly
        Response.StatusCode = (int)supabaseResponse.StatusCode;

        // Forward content type
        if (supabaseResponse.Content.Headers.ContentType != null)
        {
            Response.ContentType = supabaseResponse.Content.Headers.ContentType.ToString();
        }
        else
        {
            Response.ContentType = "application/json";
        }

        // Forward Content-Range if present (important for PostgREST pagination)
        if (supabaseResponse.Content.Headers.TryGetValues("Content-Range", out var contentRangeValues))
        {
            Response.Headers["Content-Range"] = contentRangeValues.ToArray();
        }

        // Return the content
        return Content(content, Response.ContentType);
    }
}

