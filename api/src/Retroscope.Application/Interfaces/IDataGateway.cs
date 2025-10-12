namespace Retroscope.Application.Interfaces;

/// <summary>
/// Unified data gateway that supports routing to Supabase or Postgres
/// </summary>
public interface IDataGateway : ISupabaseGateway, IPostgresGateway
{
}

