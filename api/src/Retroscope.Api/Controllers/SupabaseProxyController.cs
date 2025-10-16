using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Text;

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
    public async Task<IActionResult> ProxyRequest(string? path = null)
    {
        try
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader))
            {
                return Unauthorized(new { error = "Authorization header is required" });
            }

            // Get correlation ID
            var correlationId = Request.Headers["X-Correlation-Id"].FirstOrDefault()
                                ?? Request.Headers["Request-Id"].FirstOrDefault()
                                ?? Guid.NewGuid().ToString();

            // Check routing headers
            var useLocalPostgres = Request.Headers.ContainsKey("X-UseLocalPostgres");
            var useDualPath = Request.Headers.ContainsKey("X-DualPath");

            // Determine if this is a functions request or a database request
            var isEdgeFunctionRequest = path?.StartsWith("functions/", StringComparison.OrdinalIgnoreCase) ?? false;

            // Edge Functions: Always route to Supabase (no local equivalent yet)
            // Database: Support three modes based on headers
            if (isEdgeFunctionRequest)
            {
                _logger.LogInformation("Edge Function request detected, routing to Supabase only");
                return await ProxySingleRequest("FunctionsClient", path, authHeader, correlationId, isEdgeFunctionRequest);
            }

            // Database requests: Check for dual-path mode
            if (useDualPath && useLocalPostgres)
            {
                _logger.LogInformation("Dual-path mode enabled (CorrelationId: {CorrelationId})", correlationId);
                return await ProxyDualPath(path, authHeader, correlationId);
            }

            // Single path: Local Postgres or Supabase
            var clientName = useLocalPostgres ? "LocalPostgrestClient" : "PostgrestClient";
            _logger.LogInformation("Single-path mode using {ClientName} (CorrelationId: {CorrelationId})", clientName, correlationId);
            return await ProxySingleRequest(clientName, path, authHeader, correlationId, isEdgeFunctionRequest);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying request to Supabase");
            return StatusCode(502, new { error = "Failed to proxy request to Supabase", details = ex.Message });
        }
    }

    /// <summary>
    /// Builds an HTTP request to forward to Supabase or local PostgREST.
    /// </summary>
    private async Task<HttpRequestMessage> BuildSupabaseRequest(
        string path, 
        string authHeader, 
        string correlationId, 
        bool isEdgeFunctionRequest,
        string clientName = "PostgrestClient")
    {
        var supabaseAnonKey = _configuration["SUPABASE_ANON_KEY"];
        var isLocalPostgres = clientName == "LocalPostgrestClient";

        // Remove leading slash to ensure it's treated as a relative URI
        // (HttpClient with BaseAddress requires relative URIs without leading slash)
        path = path?.TrimStart('/') ?? string.Empty;

        // For Edge Functions, strip the "functions/" prefix since the FunctionsClient base URL includes it
        if (isEdgeFunctionRequest && path.StartsWith("functions/", StringComparison.OrdinalIgnoreCase))
        {
            path = path.Substring("functions/".Length);
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

        // Add Supabase API key (only for Supabase, not for local PostgREST)
        if (!isLocalPostgres && !string.IsNullOrEmpty(supabaseAnonKey))
        {
            request.Headers.TryAddWithoutValidation("apikey", supabaseAnonKey);
        }

        // Ensure Accept header is set
        request.Headers.TryAddWithoutValidation("Accept", "application/json");

        // Forward correlation ID
        request.Headers.TryAddWithoutValidation("X-Correlation-Id", correlationId);

        // Forward relevant headers from the original request
        ForwardRequestHeaders(request, isEdgeFunctionRequest);

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
    private void ForwardRequestHeaders(HttpRequestMessage supabaseRequest, bool isEdgeFunctionRequest)
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
        if (!isEdgeFunctionRequest)
        {
            headersToForward.Add("Prefer"); // Important for PostgREST (return=representation, resolution=merge-duplicates, etc.)
            headersToForward.Add("Range");
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
            supabaseResponse.StatusCode, content?.Length ?? 0);

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

    /// <summary>
    /// Proxies a request to a single backend (either Supabase or local PostgREST).
    /// </summary>
    private async Task<IActionResult> ProxySingleRequest(
        string clientName,
        string? path,
        string authHeader,
        string correlationId,
        bool isEdgeFunctionRequest)
    {
        var request = await BuildSupabaseRequest(path ?? string.Empty, authHeader, correlationId, isEdgeFunctionRequest, clientName);
        var client = _httpClientFactory.CreateClient(clientName);
        
        _logger.LogInformation("Proxying {Method} to: {BaseAddress}{RequestUri} (using {ClientName})", 
            Request.Method, client.BaseAddress, request.RequestUri, clientName);
        
        var response = await client.SendAsync(request);
        return await ForwardResponse(response);
    }

    /// <summary>
    /// Proxies a request to both Supabase and local PostgREST, compares results, and returns Supabase response.
    /// </summary>
    private async Task<IActionResult> ProxyDualPath(
        string? path,
        string authHeader,
        string correlationId)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        
        // Build requests for both backends
        var supabaseRequest = await BuildSupabaseRequest(path ?? string.Empty, authHeader, correlationId, false, "PostgrestClient");
        var postgresRequest = await BuildSupabaseRequest(path ?? string.Empty, authHeader, correlationId, false, "LocalPostgrestClient");
        
        // Execute in parallel
        var supabaseClient = _httpClientFactory.CreateClient("PostgrestClient");
        var postgresClient = _httpClientFactory.CreateClient("LocalPostgrestClient");
        
        var supabaseTask = supabaseClient.SendAsync(supabaseRequest);
        var postgresTask = postgresClient.SendAsync(postgresRequest);
        
        await Task.WhenAll(supabaseTask, postgresTask);
        sw.Stop();
        
        var supabaseResponse = await supabaseTask;
        var postgresResponse = await postgresTask;
        
        // Compare and log differences
        await CompareResponses(supabaseResponse, postgresResponse, correlationId, sw.ElapsedMilliseconds);
        
        // Return Supabase response as primary
        return await ForwardResponse(supabaseResponse);
    }

    /// <summary>
    /// Compares responses from Supabase and local PostgREST and logs any differences.
    /// </summary>
    private async Task CompareResponses(
        HttpResponseMessage supabaseResponse,
        HttpResponseMessage postgresResponse,
        string correlationId,
        long totalMs)
    {
        var supabaseContent = await supabaseResponse.Content.ReadAsStringAsync();
        var postgresContent = await postgresResponse.Content.ReadAsStringAsync();
        
        var statusMatch = supabaseResponse.StatusCode == postgresResponse.StatusCode;
        var contentMatch = supabaseContent == postgresContent;
        
        if (statusMatch && contentMatch)
        {
            _logger.LogInformation(
                "DualPath: Results MATCH (CorrelationId: {CorrelationId}, Duration: {Duration}ms, Status: {Status})",
                correlationId, totalMs, supabaseResponse.StatusCode);
        }
        else
        {
            _logger.LogWarning(
                "DualPath: Results DIFFER (CorrelationId: {CorrelationId}, Duration: {Duration}ms) " +
                "StatusMatch: {StatusMatch}, ContentMatch: {ContentMatch}, " +
                "Supabase: {SupabaseStatus} ({SupabaseLength} chars), " +
                "Postgres: {PostgresStatus} ({PostgresLength} chars)",
                correlationId, totalMs, statusMatch, contentMatch,
                supabaseResponse.StatusCode, supabaseContent.Length,
                postgresResponse.StatusCode, postgresContent.Length);
            
            if (!contentMatch && supabaseContent.Length < 5000 && postgresContent.Length < 5000)
            {
                _logger.LogDebug(
                    "DualPath Content Diff (CorrelationId: {CorrelationId}): " +
                    "Supabase: {SupabaseContent}, Postgres: {PostgresContent}",
                    correlationId, supabaseContent, postgresContent);
            }
        }
    }
}

