using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("retro_comments", Schema = "public")]
public class RetroComment
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("item_id")]
    public Guid ItemId { get; set; }

    [Required]
    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Required]
    [Column("created_by")]
    public Guid CreatedBy { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey("ItemId")]
    public RetroItem? RetroItem { get; set; }
}

