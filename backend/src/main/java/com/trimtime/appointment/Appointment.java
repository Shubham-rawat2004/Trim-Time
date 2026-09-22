package com.trimtime.appointment;

import com.trimtime.identity.UserAccount; import com.trimtime.salon.Salon; import jakarta.persistence.*; import java.math.BigDecimal; import java.time.*; import java.util.UUID;

@Entity @Table(name="appointments") public class Appointment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="booking_reference",nullable=false,unique=true,length=36) private String bookingReference;
 @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="customer_user_id",nullable=false) private UserAccount customer;
 @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="salon_id",nullable=false) private Salon salon;
 @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="barber_user_id",nullable=false) private UserAccount barber;
 @Column(name="start_at",nullable=false) private LocalDateTime startAt; @Column(name="end_at",nullable=false) private LocalDateTime endAt;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=24) private AppointmentStatus status;
 @Column(name="service_name",nullable=false,length=2000) private String serviceName; @Column(name="addon_summary",length=2000) private String addonSummary;
 @Column(name="duration_minutes",nullable=false) private int durationMinutes; @Column(name="total_price",nullable=false,precision=10,scale=2) private BigDecimal totalPrice; @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 protected Appointment(){}
 public Appointment(UserAccount customer,Salon salon,UserAccount barber,LocalDateTime startAt,LocalDateTime endAt,String serviceName,String addonSummary,int durationMinutes,BigDecimal totalPrice){this.bookingReference=UUID.randomUUID().toString();this.customer=customer;this.salon=salon;this.barber=barber;this.startAt=startAt;this.endAt=endAt;this.status=AppointmentStatus.CONFIRMED;this.serviceName=serviceName;this.addonSummary=addonSummary;this.durationMinutes=durationMinutes;this.totalPrice=totalPrice;}
 public Long getId(){return id;} public String getBookingReference(){return bookingReference;} public UserAccount getCustomer(){return customer;} public Salon getSalon(){return salon;} public UserAccount getBarber(){return barber;} public LocalDateTime getStartAt(){return startAt;} public LocalDateTime getEndAt(){return endAt;} public AppointmentStatus getStatus(){return status;} public String getServiceName(){return serviceName;} public String getAddonSummary(){return addonSummary;} public int getDurationMinutes(){return durationMinutes;} public BigDecimal getTotalPrice(){return totalPrice;}
}
