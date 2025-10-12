using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Retroscope.Infrastructure.Routing;

public class DualPathComparer
{
    private readonly ILogger<DualPathComparer> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public DualPathComparer(ILogger<DualPathComparer> logger)
    {
        _logger = logger;
    }

    public void LogDifferences<T>(
        string operation,
        T supabaseResult,
        T postgresResult,
        string? correlationId)
    {
        try
        {
            var supabaseJson = JsonSerializer.Serialize(supabaseResult, _jsonOptions);
            var postgresJson = JsonSerializer.Serialize(postgresResult, _jsonOptions);

            var areSame = string.Equals(supabaseJson, postgresJson, StringComparison.Ordinal);

            if (areSame)
            {
                _logger.LogInformation(
                    "DualPath {Operation}: Results match (CorrelationId: {CorrelationId})",
                    operation,
                    correlationId);
            }
            else
            {
                _logger.LogWarning(
                    "DualPath {Operation}: Results differ (CorrelationId: {CorrelationId})\n" +
                    "Supabase: {SupabaseJson}\n" +
                    "Postgres: {PostgresJson}",
                    operation,
                    correlationId,
                    supabaseJson,
                    postgresJson);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to compare dual-path results for {Operation} (CorrelationId: {CorrelationId})",
                operation,
                correlationId);
        }
    }

    public void LogTiming(
        string operation,
        long supabaseMs,
        long postgresMs,
        string? correlationId)
    {
        var faster = supabaseMs < postgresMs ? "Supabase" : "Postgres";
        var difference = Math.Abs(supabaseMs - postgresMs);

        _logger.LogInformation(
            "DualPath {Operation}: Timing - Supabase={SupabaseMs}ms, Postgres={PostgresMs}ms, {Faster} was faster by {DifferenceMs}ms (CorrelationId: {CorrelationId})",
            operation,
            supabaseMs,
            postgresMs,
            faster,
            difference,
            correlationId);
    }
}

