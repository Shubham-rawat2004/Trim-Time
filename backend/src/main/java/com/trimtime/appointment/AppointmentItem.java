package com.trimtime.appointment;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "appointment_items")
public class AppointmentItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "appointment_id", nullable = false) private Appointment appointment;
    @Enumerated(EnumType.STRING) @Column(name = "item_kind", nullable = false, length = 16) private AppointmentItemKind kind;
    @Column(name = "catalogue_item_id", nullable = false) private Long catalogueItemId;
    @Column(name = "name_snapshot", nullable = false, length = 160) private String name;
    @Column(name = "price_snapshot", nullable = false, precision = 10, scale = 2) private BigDecimal price;
    @Column(name = "duration_minutes_snapshot", nullable = false) private int durationMinutes;
    @Column(name = "display_order", nullable = false) private int displayOrder;

    protected AppointmentItem() {}

    AppointmentItem(Appointment appointment, AppointmentItemKind kind, Long catalogueItemId,
                    String name, BigDecimal price, int durationMinutes, int displayOrder) {
        this.appointment = appointment;
        this.kind = kind;
        this.catalogueItemId = catalogueItemId;
        this.name = name;
        this.price = price;
        this.durationMinutes = durationMinutes;
        this.displayOrder = displayOrder;
    }

    public Long getId() { return id; }
    public AppointmentItemKind getKind() { return kind; }
    public Long getCatalogueItemId() { return catalogueItemId; }
    public String getName() { return name; }
    public BigDecimal getPrice() { return price; }
    public int getDurationMinutes() { return durationMinutes; }
    public int getDisplayOrder() { return displayOrder; }
}
