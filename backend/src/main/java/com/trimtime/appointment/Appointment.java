package com.trimtime.appointment;

import com.trimtime.identity.UserAccount;
import com.trimtime.salon.Salon;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Entity
@Table(name="appointments")
public class Appointment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;

    @Column(name="booking_reference",nullable=false,unique=true,length=36)
    private String bookingReference;

    @Column(name="request_key",length=100)
    private String requestKey;

    @Column(name="request_fingerprint",length=64)
    private String requestFingerprint;

    @ManyToOne(fetch=FetchType.EAGER)
    @JoinColumn(name="customer_user_id",nullable=false)
    private UserAccount customer;

    @ManyToOne(fetch=FetchType.EAGER)
    @JoinColumn(name="salon_id",nullable=false)
    private Salon salon;

    @ManyToOne(fetch=FetchType.EAGER)
    @JoinColumn(name="barber_user_id",nullable=false)
    private UserAccount barber;

    @Column(name="start_at",nullable=false)
    private LocalDateTime startAt;

    @Column(name="end_at",nullable=false)
    private LocalDateTime endAt;

    @Column(name="start_instant")
    private Instant startInstant;

    @Column(name="end_instant")
    private Instant endInstant;

    @Column(name="salon_timezone",length=64)
    private String salonTimezone;

    @Enumerated(EnumType.STRING)
    @Column(nullable=false,length=24)
    private AppointmentStatus status;

    @Column(name="service_name",nullable=false,length=2000)
    private String serviceName;

    @Column(name="addon_summary",length=2000)
    private String addonSummary;

    @Column(name="duration_minutes",nullable=false)
    private int durationMinutes;

    @Column(name="total_price",nullable=false,precision=10,scale=2)
    private BigDecimal totalPrice;

    @Column(name="created_at",nullable=false)
    private Instant createdAt = Instant.now();

    @ElementCollection
    @CollectionTable(name="appointment_required_services", joinColumns=@JoinColumn(name="appointment_id"))
    @Column(name="service_id",nullable=false)
    private Set<Long> requiredServiceIds = new HashSet<>();

    @OneToMany(mappedBy="appointment",cascade=CascadeType.ALL,orphanRemoval=true,fetch=FetchType.EAGER)
    @OrderBy("displayOrder ASC")
    private List<AppointmentItem> items = new ArrayList<>();

    public Set<Long> getRequiredServiceIds() { return Collections.unmodifiableSet(requiredServiceIds); }
    public void recordRequiredServices(Collection<Long> ids) { requiredServiceIds.addAll(ids); }
    public List<AppointmentItem> getItems() { return Collections.unmodifiableList(items); }
    public void addItem(AppointmentItemKind kind, Long catalogueItemId, String name, BigDecimal price, int durationMinutes) {
        items.add(new AppointmentItem(this, kind, catalogueItemId, name, price, durationMinutes, items.size()));
    }

    protected Appointment() {}

    public Appointment(UserAccount customer, Salon salon, UserAccount barber, LocalDateTime startAt, LocalDateTime endAt,
                       Instant startInstant, Instant endInstant, String serviceName, String addonSummary,
                       int durationMinutes, BigDecimal totalPrice, String requestKey, String requestFingerprint) {
        this.bookingReference = UUID.randomUUID().toString();
        this.customer = customer;
        this.salon = salon;
        this.barber = barber;
        this.startAt = startAt;
        this.endAt = endAt;
        this.startInstant = startInstant;
        this.endInstant = endInstant;
        this.salonTimezone = salon.getTimezone();
        this.status = AppointmentStatus.CONFIRMED;
        this.serviceName = serviceName;
        this.addonSummary = addonSummary;
        this.durationMinutes = durationMinutes;
        this.totalPrice = totalPrice;
        this.requestKey = requestKey;
        this.requestFingerprint = requestFingerprint;
    }

    public Long getId() { return id; }
    public String getBookingReference() { return bookingReference; }
    public String getRequestKey() { return requestKey; }
    public String getRequestFingerprint() { return requestFingerprint; }
    public UserAccount getCustomer() { return customer; }
    public Salon getSalon() { return salon; }
    public UserAccount getBarber() { return barber; }
    public LocalDateTime getStartAt() { return startAt; }
    public LocalDateTime getEndAt() { return endAt; }
    public Instant getStartInstant() { return startInstant; }
    public Instant getEndInstant() { return endInstant; }
    public String getSalonTimezone() { return salonTimezone; }
    public AppointmentStatus getStatus() { return status; }
    public void startProgress() { this.status = AppointmentStatus.IN_PROGRESS; }
    public void complete() { this.status = AppointmentStatus.COMPLETED; }
    public void markNoShow() { this.status = AppointmentStatus.NO_SHOW; }
    public void cancel() { this.status = AppointmentStatus.CANCELLED; }
    public String getServiceName() { return serviceName; }
    public String getAddonSummary() { return addonSummary; }
    public int getDurationMinutes() { return durationMinutes; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public void reassignBarber(UserAccount newBarber) { this.barber = newBarber; }
}
