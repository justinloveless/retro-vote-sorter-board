using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("profiles", Schema = "public")]
public class Profile
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("full_name")]
    public string? FullName { get; set; }

    [Column("display_name")]
    public string? DisplayName { get; set; }

    [Column("email")]
    public string? Email { get; set; }

    [Column("avatar_url")]
    public string? AvatarUrl { get; set; }

    [Column("role")]
    public string? Role { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

