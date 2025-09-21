using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Extensions.Http;

namespace Retroscope.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSupabaseGateway(this IServiceCollection services, IConfiguration configuration)
    {
        // Configure HTTP clients with Polly retry policies
        services.AddHttpClient("PostgrestClient", client =>
        {
            var postgrestUrl = configuration["SUPABASE_POSTGREST_URL"];
            if (!string.IsNullOrEmpty(postgrestUrl))
            {
                client.BaseAddress = new Uri(postgrestUrl);
            }
            
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            client.DefaultRequestHeaders.Add("Content-Type", "application/json");
        })
        .AddPolicyHandler(GetRetryPolicy());

        services.AddHttpClient("FunctionsClient", client =>
        {
            var functionsUrl = configuration["SUPABASE_FUNCTIONS_URL"];
            if (!string.IsNullOrEmpty(functionsUrl))
            {
                client.BaseAddress = new Uri(functionsUrl);
            }
            
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            client.DefaultRequestHeaders.Add("Content-Type", "application/json");
        })
        .AddPolicyHandler(GetRetryPolicy());

        // Register the gateway
        services.AddScoped<Application.Interfaces.ISupabaseGateway, SupabaseGateway>();

        return services;
    }

    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError() // Handles HttpRequestException and 5XX and 408 HTTP status codes
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)), // Exponential backoff
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    // Log retry attempts if needed
                });
    }
}
