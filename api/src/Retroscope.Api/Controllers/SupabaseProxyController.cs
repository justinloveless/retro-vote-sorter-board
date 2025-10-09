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
    /// Forwards any HTTP request to Supabase PostgREST API.
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

            // Build the Supabase request
            var supabaseRequest = await BuildSupabaseRequest(path ?? string.Empty, authHeader, correlationId);

            // Send the request to Supabase
            var client = _httpClientFactory.CreateClient("PostgrestClient");
            var response = await client.SendAsync(supabaseRequest, HttpCompletionOption.ResponseHeadersRead);

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
    /// Builds an HTTP request to forward to Supabase.
    /// </summary>
    private async Task<HttpRequestMessage> BuildSupabaseRequest(string path, string authHeader, string correlationId)
    {
        var supabaseAnonKey = _configuration["SUPABASE_ANON_KEY"];

        // Preserve query string
        var queryString = Request.QueryString.HasValue ? Request.QueryString.Value : string.Empty;
        var requestUri = $"{path}{queryString}";

        var request = new HttpRequestMessage(new HttpMethod(Request.Method), requestUri);

        // Forward the authorization header
        if (!string.IsNullOrEmpty(authHeader))
        {
            request.Headers.TryAddWithoutValidation("Authorization", authHeader);
        }

        // Add Supabase API key
        if (!string.IsNullOrEmpty(supabaseAnonKey))
        {
            request.Headers.TryAddWithoutValidation("apikey", supabaseAnonKey);
        }

        // Forward correlation ID
        request.Headers.TryAddWithoutValidation("X-Correlation-Id", correlationId);

        // Forward relevant headers from the original request
        ForwardRequestHeaders(request);

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
    private void ForwardRequestHeaders(HttpRequestMessage supabaseRequest)
    {
        // Headers to forward (excluding those we handle separately)
        var headersToForward = new[]
        {
            "Accept",
            "Accept-Encoding",
            "Accept-Language",
            "Prefer", // Important for PostgREST (return=representation, resolution=merge-duplicates, etc.)
            "Range",
            "X-Tenant",
        };

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

        // Create the result with the same status code
        var result = new ContentResult
        {
            StatusCode = (int)supabaseResponse.StatusCode,
            Content = content,
            ContentType = supabaseResponse.Content.Headers.ContentType?.ToString() ?? "application/json"
        };

        // Forward relevant response headers
        foreach (var header in supabaseResponse.Headers)
        {
            // Skip headers that ASP.NET Core manages automatically
            if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase) ||
                header.Key.Equals("Connection", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            Response.Headers[header.Key] = header.Value.ToArray();
        }

        // Forward content headers (like Content-Range, which is important for PostgREST pagination)
        foreach (var header in supabaseResponse.Content.Headers)
        {
            if (header.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase) ||
                header.Key.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
            {
                continue; // Already handled by ASP.NET Core
            }

            Response.Headers[header.Key] = header.Value.ToArray();
        }

        return result;
    }
}

